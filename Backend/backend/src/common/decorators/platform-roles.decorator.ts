import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';

export const PLATFORM_ROLES_KEY = 'platformRoles';

/**
 * Restricts a route to one or more platform-level user roles
 * (SUPER_ADMIN / PLATFORM_SUPPORT / USER). Enforced by PlatformRoleGuard.
 */
export const PlatformRoles = (...roles: UserRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
