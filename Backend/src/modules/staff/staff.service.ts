import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { UserRole } from '../../generated/prisma/enums';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SYSTEM_ROLE_NAMES } from '../rbac/system-roles/system-roles.constants';
import { AuditService } from '../audit/audit.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { PasswordResetService } from '../auth/password-reset.service';
import type {
  AssignRolesDto,
  CreateStaffDto,
  UpdateStaffDto,
} from './dto/staff.dto';

const BCRYPT_ROUNDS = 10;

export interface StaffListFilters {
  branchId?: string;
  departmentId?: string;
  groupId?: string;
  search?: string;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly planLimits: PlanLimitsService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateStaffDto,
    actorUserId: string,
    abilities: AbilitiesContext,
  ) {
    await this.planLimits.enforceStaffLimit(tenantId);
    await this.assertBranchAccess(tenantId, dto.branchId, abilities);

    const generatedPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(generatedPassword, BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const email = dto.email.toLowerCase();
      let user = await tx.user.findUnique({ where: { email } });
      let createdUser = false;
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: 'USER',
          },
        });
        createdUser = true;
      }

      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        update: {},
        create: { tenantId, userId: user.id },
      });

      const staffRecord = await tx.staffRecord.create({
        data: {
          tenantId,
          userId: user.id,
          branchId: dto.branchId,
          departmentId: dto.departmentId ?? null,
          jobTitle: dto.jobTitle ?? null,
          employeeCode: dto.employeeCode ?? null,
          joinedAt: dto.joinedAt ?? null,
        },
      });

      if (dto.roleIds?.length) {
        const roles = await tx.companyRole.findMany({
          where: { tenantId, id: { in: dto.roleIds } },
          select: { id: true, name: true },
        });
        if (roles.length !== dto.roleIds.length) {
          throw new BadRequestException('One or more roles are invalid');
        }

        if (roles.some((r) => r.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN)) {
          throw new BadRequestException(
            'The COMPANY_ADMIN role is reserved for the company creator and cannot be assigned.',
          );
        }

        if (
          roles.some((r) => r.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN) &&
          !dto.branchId
        ) {
          throw new BadRequestException(
            'BRANCH_ADMIN role requires a branchId.',
          );
        }

        let userRole: UserRole = UserRole.USER;
        if (roles.some((r) => r.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN)) {
          userRole = UserRole.BRANCH_ADMIN;
        }

        if (createdUser) {
          await tx.user.update({
            where: { id: user.id },
            data: { role: userRole },
          });
        }

        for (const role of roles) {
          await this.ensureRoleAssignment(tx, {
            tenantId,
            userId: user.id,
            companyRoleId: role.id,
            branchId:
              role.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN
                ? dto.branchId
                : null,
            assignedByUserId: actorUserId,
          });
        }
      }

      if (dto.groupIds?.length) {
        const groups = await tx.group.findMany({
          where: { tenantId, branchId: dto.branchId, id: { in: dto.groupIds } },
          select: { id: true },
        });
        if (groups.length !== dto.groupIds.length) {
          throw new BadRequestException(
            'One or more groups are invalid or belong to another branch',
          );
        }
        await tx.staffGroup.createMany({
          data: groups.map((g) => ({
            staffRecordId: staffRecord.id,
            groupId: g.id,
          })),
          skipDuplicates: true,
        });
      }

      return { staffRecord, user, createdUser };
    });

    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'STAFF_CREATE',
      entityType: 'StaffRecord',
      entityId: result.staffRecord.id,
      metadata: {
        userId: result.user.id,
        email: result.user.email,
        roleIds: dto.roleIds ?? [],
      },
    });

    return {
      staffRecord: result.staffRecord,
      user: this.sanitizeUser(result.user),
      temporaryPassword: result.createdUser ? generatedPassword : undefined,
    };
  }

  async list(
    tenantId: string,
    abilities: AbilitiesContext,
    filters: StaffListFilters,
  ) {
    const where: Prisma.StaffRecordWhereInput = { tenantId };

    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    } else if (filters.branchId) {
      await this.assertBranchAccess(tenantId, filters.branchId);
      where.branchId = filters.branchId;
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.groupId) {
      where.staffGroups = { some: { groupId: filters.groupId } };
    }

    if (filters.search) {
      const term = filters.search.trim();
      if (term) {
        where.user = {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        };
      }
    }

    const records = await this.prisma.staffRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.staffInclude(),
    });

    return records.map((r) => this.present(r));
  }

  async getOne(tenantId: string, staffId: string, abilities: AbilitiesContext) {
    const record = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
      include: this.staffInclude(),
    });
    if (!record) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(tenantId, record.branchId, abilities);
    return this.present(record);
  }

  async update(
    tenantId: string,
    staffId: string,
    dto: UpdateStaffDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(
      tenantId,
      dto.branchId ?? existing.branchId,
      abilities,
    );

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          tenantId,
          branchId: dto.branchId ?? existing.branchId,
        },
        select: { id: true },
      });
      if (!department) {
        throw new BadRequestException(
          'Department does not belong to the staff branch',
        );
      }
    }

    const record = await this.prisma.staffRecord.update({
      where: { id: staffId },
      data: {
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        jobTitle: dto.jobTitle,
        employeeCode: dto.employeeCode,
        joinedAt: dto.joinedAt,
        isActive: dto.isActive,
      },
      include: this.staffInclude(),
    });
    return this.present(record);
  }

  async remove(
    tenantId: string,
    staffId: string,
    actorUserId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(tenantId, existing.branchId, abilities);
    await this.prisma.staffRecord.update({
      where: { id: staffId },
      data: { isActive: false },
    });
    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'STAFF_DEACTIVATE',
      entityType: 'StaffRecord',
      entityId: staffId,
      metadata: { userId: existing.userId },
    });
  }

  async resetPassword(
    tenantId: string,
    staffId: string,
    actorUserId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(tenantId, existing.branchId, abilities);

    const result = await this.passwordReset.issueAndEmailForUser(
      existing.user.id,
      existing.user.email,
    );

    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'STAFF_RESET_PASSWORD',
      entityType: 'StaffRecord',
      entityId: staffId,
      metadata: { email: existing.user.email },
    });

    return {
      message: result.sent
        ? 'Password reset link sent.'
        : 'Reset link could not be emailed (no SMTP configured); the reset token is logged server-side.',
      ...(result.token ? { temporaryToken: result.token } : {}),
    };
  }

  async assignRoles(
    tenantId: string,
    staffId: string,
    dto: AssignRolesDto,
    actorUserId: string,
    abilities: AbilitiesContext,
  ) {
    const record = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
    });
    if (!record) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(tenantId, record.branchId, abilities);

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found in this tenant');
      }
    }

    const roles = await this.prisma.companyRole.findMany({
      where: { tenantId, id: { in: dto.roleIds } },
      select: { id: true, name: true },
    });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    if (roles.some((r) => r.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN)) {
      throw new BadRequestException(
        'The COMPANY_ADMIN role is reserved for the company creator and cannot be assigned.',
      );
    }

    if (
      roles.some((r) => r.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN) &&
      !dto.branchId
    ) {
      throw new BadRequestException('BRANCH_ADMIN role requires a branchId.');
    }

    let userRole: UserRole = UserRole.USER;
    if (roles.some((r) => r.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN)) {
      userRole = UserRole.BRANCH_ADMIN;
    }

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { role: userRole },
    });

    for (const role of roles) {
      await this.ensureRoleAssignment(this.prisma, {
        tenantId,
        userId: record.userId,
        companyRoleId: role.id,
        branchId:
          role.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN
            ? (dto.branchId ?? null)
            : null,
        assignedByUserId: actorUserId,
      });
    }
    return this.getOne(tenantId, staffId, abilities);
  }

  async removeRole(
    tenantId: string,
    staffId: string,
    assignmentId: string,
    abilities: AbilitiesContext,
  ) {
    const record = await this.prisma.staffRecord.findFirst({
      where: { id: staffId, tenantId },
    });
    if (!record) {
      throw new NotFoundException('Staff record not found');
    }
    await this.assertBranchAccess(tenantId, record.branchId, abilities);

    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { id: assignmentId, tenantId, userId: record.userId },
      include: { companyRole: { select: { name: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Role assignment not found');
    }

    if (assignment.companyRole.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN) {
      const adminCount = await this.prisma.roleAssignment.count({
        where: {
          tenantId,
          companyRole: { name: SYSTEM_ROLE_NAMES.COMPANY_ADMIN },
        },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last company administrator',
        );
      }
    }

    await this.prisma.roleAssignment.delete({ where: { id: assignmentId } });
    return this.getOne(tenantId, staffId, abilities);
  }

  private async ensureRoleAssignment(
    client: Pick<Prisma.TransactionClient, 'roleAssignment'>,
    params: {
      tenantId: string;
      userId: string;
      companyRoleId: string;
      branchId: string | null;
      assignedByUserId: string;
    },
  ): Promise<void> {
    const existing = await client.roleAssignment.findFirst({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
        companyRoleId: params.companyRoleId,
        branchId: params.branchId,
      },
    });
    if (!existing) {
      await client.roleAssignment.create({ data: params });
    }
  }

  private staffInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          isActive: true,
          roleAssignments: {
            include: {
              companyRole: {
                select: {
                  id: true,
                  name: true,
                  isSystem: true,
                  branchId: true,
                  permissions: true,
                },
              },
            },
          },
        },
      },
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      staffGroups: { include: { group: { select: { id: true, name: true } } } },
    };
  }

  private present(record: {
    id: string;
    tenantId: string;
    userId: string;
    branchId: string;
    departmentId: string | null;
    jobTitle: string | null;
    employeeCode: string | null;
    isActive: boolean;
    joinedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roleAssignments: Array<{
        id: string;
        branchId: string | null;
        companyRole: {
          id: string;
          name: string;
          isSystem: boolean;
          branchId: string | null;
          permissions: string[];
        };
      }>;
    };
    branch: { id: string; name: string };
    department: { id: string; name: string } | null;
    staffGroups: Array<{ group: { id: string; name: string } }>;
  }) {
    return {
      id: record.id,
      branchId: record.branchId,
      departmentId: record.departmentId,
      jobTitle: record.jobTitle,
      employeeCode: record.employeeCode,
      isActive: record.isActive,
      joinedAt: record.joinedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      user: {
        id: record.user.id,
        email: record.user.email,
        firstName: record.user.firstName,
        lastName: record.user.lastName,
      },
      branch: record.branch,
      department: record.department,
      roles: record.user.roleAssignments.map((ra) => ({
        ...ra.companyRole,
        assignmentId: ra.id,
        branchId: ra.branchId,
      })),
      groups: record.staffGroups.map((sg) => sg.group),
    };
  }

  private sanitizeUser(user: {
    passwordHash?: string;
    [key: string]: unknown;
  }) {
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    abilities?: AbilitiesContext,
  ): Promise<void> {
    if (abilities && abilities.accessibleBranchIds !== null) {
      if (!abilities.accessibleBranchIds.includes(branchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found in this tenant');
    }
  }
}
