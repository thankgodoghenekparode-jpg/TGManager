import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '../../modules/rbac/permissions/permissions.constants';
import { AbilitiesService } from '../../modules/rbac/abilities/abilities.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { PermissionRequest } from '../types/permission-request.interface';

/**
 * Enforces company-level permissions on a route. Must run after TenantGuard so
 * that `request.tenant` is available. Resolves and attaches the user's RBAC
 * context (`request.abilities`) and checks the @Permissions metadata.
 */
@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilities: AbilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<PermissionRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    if (!request.tenant) {
      throw new BadRequestException('Tenant context missing');
    }

    const context_ = await this.abilities.resolveContext(
      request.tenant.id,
      request.user.sub,
    );
    request.abilities = context_;

    if (!required || required.length === 0) {
      return true;
    }
    if (context_.isCompanyAdmin) {
      return true;
    }

    const granted = new Set(context_.permissions);
    const allowed = required.every((permission) => granted.has(permission));
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
