import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PASSWORD } from '../../common/default-password.constants';
import { derivedLoginEmail } from '../../common/login-email.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SYSTEM_ROLE_NAMES } from '../rbac/system-roles/system-roles.constants';
import type {
  CreateSchoolStaffDto,
  QuerySchoolStaffDto,
  UpdateSchoolStaffDto,
} from './dto/staff.dto';

/** Roles the staff flow is allowed to grant, keyed by staff category. */
const CATEGORY_ROLE: Record<string, string> = {
  TEACHER: SYSTEM_ROLE_NAMES.TEACHER,
  ACCOUNTANT: SYSTEM_ROLE_NAMES.ACCOUNTANT,
  GATE_OFFICER: SYSTEM_ROLE_NAMES.GATE_OFFICER,
};

/** Every role the staff flow can switch a person between. */
const ASSIGNABLE_ROLE_NAMES: string[] = [
  SYSTEM_ROLE_NAMES.STAFF,
  SYSTEM_ROLE_NAMES.TEACHER,
  SYSTEM_ROLE_NAMES.ACCOUNTANT,
  SYSTEM_ROLE_NAMES.GATE_OFFICER,
  SYSTEM_ROLE_NAMES.PRINCIPAL,
];

@Injectable()
export class SchoolStaffService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateEmployeeNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.schoolStaff.count({ where: { tenantId } });
    return `STF-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Finds the role to grant a staff member: an explicitly selected role wins,
   * otherwise it is inferred from the staff category (falling back to STAFF).
   */
  private async resolveStaffRole(tenantId: string, roleId?: string | null) {
    if (roleId) {
      const role = await this.prisma.companyRole.findFirst({
        where: { id: roleId, tenantId },
      });
      if (!role) {
        throw new BadRequestException('The selected role does not exist');
      }
      if (role.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN) {
        throw new BadRequestException(
          'The tenant administrator role cannot be assigned',
        );
      }
      return role;
    }
    return null;
  }

  private async findRoleByName(tenantId: string, name: string) {
    return this.prisma.companyRole.findFirst({ where: { tenantId, name } });
  }

  private async roleForCategory(tenantId: string, category: string) {
    const preferred = CATEGORY_ROLE[category] ?? SYSTEM_ROLE_NAMES.STAFF;
    return (
      (await this.findRoleByName(tenantId, preferred)) ??
      (await this.findRoleByName(tenantId, SYSTEM_ROLE_NAMES.STAFF))
    );
  }

  async list(tenantId: string, query: QuerySchoolStaffDto) {
    return this.prisma.schoolStaff.findMany({
      where: {
        tenantId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { employeeNumber: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            roleAssignments: {
              where: { tenantId },
              select: { companyRole: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: CreateSchoolStaffDto,
  ) {
    const employeeNumber =
      dto.employeeNumber ?? (await this.generateEmployeeNumber(tenantId));

    const existing = await this.prisma.schoolStaff.findFirst({
      where: { tenantId, employeeNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Employee number ${employeeNumber} is already in use`,
      );
    }

    // Every staff member added through the app also gets a portal login, so an
    // admin never has to provision the account separately.
    const role =
      (await this.resolveStaffRole(tenantId, dto.roleId)) ??
      (await this.roleForCategory(tenantId, dto.category));
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const loginEmail =
      dto.email?.trim().toLowerCase() ||
      derivedLoginEmail(employeeNumber, tenant?.slug, 'staff');
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    return this.prisma.$transaction(async (tx) => {
      let account = await tx.user.findUnique({ where: { email: loginEmail } });
      const accountCreated = !account;
      if (!account) {
        account = await tx.user.create({
          data: {
            email: loginEmail,
            firstName: dto.firstName,
            lastName: dto.lastName,
            passwordHash,
            role: 'USER',
          },
        });
      }

      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId, userId: account.id } },
        create: { tenantId, userId: account.id },
        update: {},
      });

      if (role) {
        const assignment = await tx.roleAssignment.findFirst({
          where: {
            tenantId,
            userId: account.id,
            companyRoleId: role.id,
            branchId: null,
          },
        });
        if (!assignment) {
          await tx.roleAssignment.create({
            data: {
              tenantId,
              userId: account.id,
              companyRoleId: role.id,
              assignedByUserId: actorUserId,
            },
          });
        }
      }

      const staff = await tx.schoolStaff.create({
        data: {
          tenantId,
          userId: account.id,
          employeeNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          department: dto.department,
          designation: dto.designation,
          category: dto.category,
          employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : null,
          photo: dto.photo,
          status: dto.status,
        },
      });

      return {
        ...staff,
        staffAccount: {
          email: loginEmail,
          password: accountCreated ? DEFAULT_PASSWORD : null,
          created: accountCreated,
          role: role?.name ?? null,
        },
      };
    });
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateSchoolStaffDto,
  ) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (dto.employeeNumber && dto.employeeNumber !== staff.employeeNumber) {
      const clash = await this.prisma.schoolStaff.findFirst({
        where: { tenantId, employeeNumber: dto.employeeNumber },
      });
      if (clash) {
        throw new ConflictException(
          `Employee number ${dto.employeeNumber} is already in use`,
        );
      }
    }

    // Optionally move the linked login to a different role. Existing school
    // assignments are swapped out, but unrelated roles (e.g. a parent link)
    // are left alone.
    if (dto.roleId && staff.userId) {
      const role = await this.resolveStaffRole(tenantId, dto.roleId);
      if (role) {
        await this.prisma.roleAssignment.deleteMany({
          where: {
            tenantId,
            userId: staff.userId,
            companyRole: { name: { in: ASSIGNABLE_ROLE_NAMES } },
          },
        });
        await this.prisma.roleAssignment.create({
          data: {
            tenantId,
            userId: staff.userId,
            companyRoleId: role.id,
            assignedByUserId: actorUserId,
          },
        });
      }
    }

    return this.prisma.schoolStaff.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.employeeNumber !== undefined
          ? { employeeNumber: dto.employeeNumber }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.employmentDate !== undefined
          ? {
              employmentDate: dto.employmentDate
                ? new Date(dto.employmentDate)
                : null,
            }
          : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.prisma.schoolStaff.delete({ where: { id } });
    return { success: true };
  }
}
