import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';

export const BRANCH_ACCESS_DENIED = 'You do not have access to this branch';
export const BRANCH_NOT_FOUND = 'Branch not found';

/**
 * Single home for tenant/branch access checks so modules stop hand-rolling
 * their own assertBranchAccess copies. Two levels:
 * - assertBranchAccess: full check (broadcast scope + tenant-scoped existence)
 *   for branchIds coming straight from DTOs / query filters.
 * - assertBranchScope: synchronous, null-tolerant check for records that were
 *   already tenant-scoped when fetched (null branch = company-wide record).
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBranchAccess(
    tenantId: string,
    branchId: string,
    abilities?: AbilitiesContext,
  ): Promise<void> {
    this.assertBranchScope(branchId, abilities);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException(BRANCH_NOT_FOUND);
  }

  assertBranchScope(
    branchId: string | null,
    abilities?: AbilitiesContext,
  ): void {
    if (
      abilities &&
      branchId !== null &&
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException(BRANCH_ACCESS_DENIED);
    }
  }
}
