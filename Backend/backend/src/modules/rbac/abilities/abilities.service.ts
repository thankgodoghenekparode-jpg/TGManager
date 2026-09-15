import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AbilitiesContext,
  AbilityRole,
} from '../../../common/types/permission-request.interface';
import { SYSTEM_ROLE_NAMES } from '../system-roles/system-roles.constants';

/**
 * Loads the effective RBAC context of a user inside a tenant: their company
 * roles, the union of granted permissions and the branches they can access.
 */
@Injectable()
export class AbilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveContext(
    tenantId: string,
    userId: string,
  ): Promise<AbilitiesContext> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { tenantId, userId },
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
    });

    const isCompanyAdmin = assignments.some(
      (a) => a.companyRole.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN,
    );

    const permissionSet = new Set<string>();
    const roles: AbilityRole[] = [];
    const branchIds = new Set<string>();
    let companyWide = false;

    for (const a of assignments) {
      for (const p of a.companyRole.permissions) permissionSet.add(p);
      roles.push({
        id: a.companyRole.id,
        name: a.companyRole.name,
        isSystem: a.companyRole.isSystem,
        branchId: a.branchId ?? a.companyRole.branchId,
      });
      if (a.branchId) {
        branchIds.add(a.branchId);
      } else {
        companyWide = true;
      }
    }

    const allBranches = isCompanyAdmin || companyWide;

    return {
      roles,
      permissions: [...permissionSet],
      isCompanyAdmin,
      accessibleBranchIds: allBranches ? null : [...branchIds],
    };
  }
}
