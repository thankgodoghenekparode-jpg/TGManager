import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums';
import { PLATFORM_ROLES_KEY } from '../decorators/platform-roles.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request.interface';

/**
 * Enforces platform-level user roles on a route. When no roles are declared
 * via @PlatformRoles, any authenticated user is allowed.
 */
@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const role = request.user.userRole;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient platform role');
    }

    return true;
  }
}
