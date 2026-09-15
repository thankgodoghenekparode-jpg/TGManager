import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ALL_PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { SYSTEM_ROLE_NAMES } from '../rbac/system-roles/system-roles.constants';
import { AuditService } from '../audit/audit.service';
import type {
  AssignRoleDto,
  CreateCompanyRoleDto,
  UpdateCompanyRoleDto,
} from './dto/company-role.dto';

@Injectable()
export class CompanyRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.companyRole.findMany({
      where: {
        tenantId,
        name: { not: SYSTEM_ROLE_NAMES.COMPANY_ADMIN },
      },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async getOne(tenantId: string, roleId: string) {
    const role = await this.prisma.companyRole.findFirst({
      where: { id: roleId, tenantId },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException('Company role not found');
    }
    return role;
  }

  async create(tenantId: string, dto: CreateCompanyRoleDto, userId: string) {
    this.assertPermissionsValid(dto.permissions);
    if (dto.branchId) {
      await this.assertBranch(tenantId, dto.branchId);
    }
    return this.prisma.companyRole.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        permissions: dto.permissions,
        branchId: dto.branchId ?? null,
        createdByUserId: userId,
      },
    });
  }

  async update(tenantId: string, roleId: string, dto: UpdateCompanyRoleDto) {
    const existing = await this.prisma.companyRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Company role not found');
    }
    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }
    if (dto.permissions) {
      this.assertPermissionsValid(dto.permissions);
    }
    return this.prisma.companyRole.update({
      where: { id: roleId },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
      },
    });
  }

  async remove(tenantId: string, roleId: string) {
    const existing = await this.prisma.companyRole.findFirst({
      where: { id: roleId, tenantId },
      include: { _count: { select: { assignments: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Company role not found');
    }
    if (existing.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }
    if (existing._count.assignments > 0) {
      throw new BadRequestException(
        'Role is assigned to users; unassign it before deleting',
      );
    }
    await this.prisma.companyRole.delete({ where: { id: roleId } });
  }

  async assign(
    tenantId: string,
    roleId: string,
    dto: AssignRoleDto,
    actorUserId: string,
    abilities: AbilitiesContext,
  ) {
    const role = await this.prisma.companyRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Company role not found');
    }

    if (role.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN) {
      throw new BadRequestException(
        'The COMPANY_ADMIN role is reserved for the company creator and cannot be assigned.',
      );
    }

    if (role.name === SYSTEM_ROLE_NAMES.BRANCH_ADMIN && !dto.branchId) {
      throw new BadRequestException(
        'BRANCH_ADMIN role requires a branch scope.',
      );
    }

    if (dto.branchId) {
      await this.assertBranch(tenantId, dto.branchId);
    }
    if (abilities.accessibleBranchIds !== null) {
      if (
        (dto.branchId &&
          !abilities.accessibleBranchIds.includes(dto.branchId)) ||
        (!dto.branchId &&
          role.branchId &&
          !abilities.accessibleBranchIds.includes(role.branchId))
      ) {
        throw new ForbiddenException('You do not have access to this scope');
      }
    }

    const member = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: dto.userId } },
    });
    if (!member) {
      throw new BadRequestException('User is not a member of this tenant');
    }

    const existing = await this.prisma.roleAssignment.findFirst({
      where: {
        tenantId,
        userId: dto.userId,
        companyRoleId: roleId,
        branchId: dto.branchId ?? null,
      },
    });
    if (!existing) {
      await this.prisma.roleAssignment.create({
        data: {
          tenantId,
          userId: dto.userId,
          companyRoleId: roleId,
          branchId: dto.branchId ?? null,
          assignedByUserId: actorUserId,
        },
      });
    }
    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'ROLE_ASSIGN',
      entityType: 'CompanyRole',
      entityId: roleId,
      metadata: {
        userId: dto.userId,
        roleName: role.name,
        branchId: dto.branchId ?? null,
      },
    });
    return this.getOne(tenantId, roleId);
  }

  async unassign(
    tenantId: string,
    roleId: string,
    assignmentId: string,
    actorUserId: string,
  ) {
    const role = await this.prisma.companyRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Company role not found');
    }
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: { id: assignmentId, tenantId, companyRoleId: roleId },
      include: { companyRole: { select: { name: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Role assignment not found');
    }
    if (assignment.companyRole.name === 'COMPANY_ADMIN') {
      const adminCount = await this.prisma.roleAssignment.count({
        where: { tenantId, companyRole: { name: 'COMPANY_ADMIN' } },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last company administrator',
        );
      }
    }
    await this.prisma.roleAssignment.delete({ where: { id: assignmentId } });
    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'ROLE_UNASSIGN',
      entityType: 'CompanyRole',
      entityId: roleId,
      metadata: {
        userId: assignment.userId,
        roleName: assignment.companyRole.name,
        branchId: assignment.branchId,
      },
    });
    return this.getOne(tenantId, roleId);
  }

  private assertPermissionsValid(permissions: string[]): void {
    const valid = new Set<string>(ALL_PERMISSIONS);
    const invalid = permissions.filter((p) => !valid.has(p));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown permission(s): ${invalid.join(', ')}`,
      );
    }
  }

  private async assertBranch(
    tenantId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found in this tenant');
    }
  }
}
