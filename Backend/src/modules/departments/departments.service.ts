import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../common/access/access-control.service';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    await this.access.assertBranchAccess(tenantId, dto.branchId);
    if (dto.managerUserId) {
      await this.assertUserInTenant(tenantId, dto.managerUserId);
    }
    return this.prisma.department.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        managerUserId: dto.managerUserId ?? null,
      },
    });
  }

  async list(tenantId: string, abilities: AbilitiesContext, branchId?: string) {
    if (branchId) {
      await this.access.assertBranchAccess(tenantId, branchId);
    }
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
    } = { tenantId };
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    } else if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.department.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        managerUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { staffRecords: true, schedules: true } },
      },
    });
  }

  async getOne(
    tenantId: string,
    departmentId: string,
    abilities: AbilitiesContext,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        managerUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { staffRecords: true, schedules: true } },
      },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    await this.access.assertBranchAccess(
      tenantId,
      department.branchId,
      abilities,
    );
    return department;
  }

  async update(
    tenantId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    await this.access.assertBranchAccess(
      tenantId,
      dto.branchId ?? existing.branchId,
      abilities,
    );
    if (dto.managerUserId) {
      await this.assertUserInTenant(tenantId, dto.managerUserId);
    }
    return this.prisma.department.update({
      where: { id: departmentId },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        managerUserId: dto.managerUserId,
      },
    });
  }

  async remove(
    tenantId: string,
    departmentId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    await this.access.assertBranchAccess(
      tenantId,
      existing.branchId,
      abilities,
    );
    await this.prisma.department.delete({ where: { id: departmentId } });
  }

  private async assertUserInTenant(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!member) {
      throw new BadRequestException('Manager must be a member of this tenant');
    }
  }
}
