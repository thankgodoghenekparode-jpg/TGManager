import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilitiesService } from '../../modules/rbac/abilities/abilities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AbilitiesGuard } from './abilities.guard';
import { TenantGuard } from './tenant.guard';

/**
 * One-shot tenant guard for company modules. Resolves the active tenant from
 * the `x-tenant-id` header and verifies membership (TenantGuard), then resolves
 * the user's company/branch abilities and enforces @Permissions metadata
 * (AbilitiesGuard). New tenant-scoped modules should use
 * `@UseGuards(AccessGuard)` so tenant context, branch grants (accessibleBranchIds),
 * and permission gates can never be forgotten.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilitiesService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> {
    const tenantGuard = new TenantGuard(this.prisma);
    const abilitiesGuard = new AbilitiesGuard(this.reflector, this.abilities);
    return tenantGuard.canActivate(context).then((tenantOk) => {
      if (!tenantOk) return false;
      return abilitiesGuard.canActivate(context);
    });
  }
}
