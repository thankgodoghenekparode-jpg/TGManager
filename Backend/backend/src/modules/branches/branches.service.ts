import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import type { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async create(tenantId: string, dto: CreateBranchDto) {
    await this.planLimits.enforceBranchLimit(tenantId);

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: { tenantId, ...dto },
      });

      // Advance onboarding: PENDING_BRANCH -> BRANCH_CREATED (idempotent).
      await tx.tenant.updateMany({
        where: { id: tenantId, onboardingStatus: 'PENDING_BRANCH' },
        data: { onboardingStatus: 'BRANCH_CREATED' },
      });

      return branch;
    });
  }

  async list(tenantId: string, abilities: AbilitiesContext) {
    const where: { tenantId: string; id?: { in: string[] } } = { tenantId };
    if (abilities.accessibleBranchIds !== null) {
      where.id = { in: abilities.accessibleBranchIds };
    }
    return this.prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOne(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ) {
    await this.assertAccessible(tenantId, branchId, abilities);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: {
        _count: {
          select: { departments: true, groups: true, staffRecords: true },
        },
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(
    tenantId: string,
    branchId: string,
    dto: UpdateBranchDto,
    abilities: AbilitiesContext,
  ) {
    await this.assertAccessible(tenantId, branchId, abilities);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return this.prisma.branch.update({
      where: { id: branchId },
      data: dto,
    });
  }

  async remove(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ) {
    await this.assertAccessible(tenantId, branchId, abilities);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    await this.prisma.branch.delete({ where: { id: branchId } });
  }

  private async assertAccessible(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }
}
