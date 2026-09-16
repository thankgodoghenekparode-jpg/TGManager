import { TenantRequest } from './tenant-request.interface';

export interface AbilityRole {
  id: string;
  name: string;
  isSystem: boolean;
  branchId: string | null;
}

/**
 * Resolved RBAC state for the current user within the active tenant.
 * `accessibleBranchIds` is `null` when the user is company-wide (all branches),
 * otherwise the set of branches their branch-scoped roles grant access to.
 */
export interface AbilitiesContext {
  roles: AbilityRole[];
  permissions: string[];
  isCompanyAdmin: boolean;
  accessibleBranchIds: string[] | null;
}

export interface PermissionRequest extends TenantRequest {
  abilities: AbilitiesContext;
}
