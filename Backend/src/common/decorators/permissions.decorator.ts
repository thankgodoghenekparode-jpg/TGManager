import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../modules/rbac/permissions/permissions.constants';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the company-level permission(s) a route requires.
 * Enforced by AccessGuard / AbilitiesGuard (runs after tenant resolution).
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
