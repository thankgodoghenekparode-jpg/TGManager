import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../modules/rbac/permissions/permissions.constants';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
/**
 * Metadata for "any of these permissions" routes. Checked separately from
 * `REQUIRED_PERMISSIONS_KEY` (which requires every listed permission).
 */
export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/**
 * Declares the company-level permission(s) a route requires.
 * Enforced by AccessGuard / AbilitiesGuard (runs after tenant resolution).
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Declares that a route is satisfied when the caller holds **at least one** of
 * the listed permissions (logical OR). Useful where the same resource is
 * managed under either an umbrella permission (e.g. `school.manage`) or the
 * granular permission used by the equivalent company workspace (e.g.
 * `staff.create`). `@Permissions(...)` on the same route is still enforced as
 * an additional ALL requirement.
 */
export const AnyPermissions = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
