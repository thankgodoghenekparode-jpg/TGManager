import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateGroupDto,
  GroupMembersDto,
  UpdateGroupDto,
} from './dto/group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateGroupDto) {
    await this.assertBranchAccess(tenantId, dto.branchId);
    return this.prisma.group.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description ?? null,
      },
    });
  }

  async list(tenantId: string, abilities: AbilitiesContext, branchId?: string) {
    if (branchId) {
      await this.assertBranchAccess(tenantId, branchId);
    }
    const where: { tenantId: string; branchId?: string | { in: string[] } } = {
      tenantId,
    };
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    } else if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.group.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { staffGroups: true } } },
    });
  }

  async getOne(tenantId: string, groupId: string, abilities: AbilitiesContext) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        staffGroups: {
          include: {
            staffRecord: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    await this.assertBranchAccess(tenantId, group.branchId, abilities);
    return {
      ...group,
      members: group.staffGroups.map((sg) => sg.staffRecord),
    };
  }

  async update(
    tenantId: string,
    groupId: string,
    dto: UpdateGroupDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Group not found');
    }
    await this.assertBranchAccess(
      tenantId,
      dto.branchId ?? existing.branchId,
      abilities,
    );
    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(tenantId: string, groupId: string, abilities: AbilitiesContext) {
    const existing = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Group not found');
    }
    await this.assertBranchAccess(tenantId, existing.branchId, abilities);
    await this.prisma.group.delete({ where: { id: groupId } });
  }

  async addMembers(
    tenantId: string,
    groupId: string,
    dto: GroupMembersDto,
    abilities: AbilitiesContext,
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    await this.assertBranchAccess(tenantId, group.branchId, abilities);

    const staff = await this.prisma.staffRecord.findMany({
      where: {
        id: { in: dto.staffRecordIds },
        tenantId,
        branchId: group.branchId,
        isActive: true,
      },
      select: { id: true },
    });
    if (staff.length !== dto.staffRecordIds.length) {
      throw new BadRequestException(
        'One or more staff members are not in the group branch',
      );
    }
    await this.prisma.staffGroup.createMany({
      data: staff.map((s) => ({ staffRecordId: s.id, groupId })),
      skipDuplicates: true,
    });
    return this.getOne(tenantId, groupId, abilities);
  }

  async removeMember(
    tenantId: string,
    groupId: string,
    staffRecordId: string,
    abilities: AbilitiesContext,
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    await this.assertBranchAccess(tenantId, group.branchId, abilities);
    await this.prisma.staffGroup.deleteMany({
      where: { groupId, staffRecordId },
    });
    return this.getOne(tenantId, groupId, abilities);
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
