import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantRequest } from '../types/tenant-request.interface';

export const TENANT_ID_HEADER = 'x-tenant-id';

/**
 * Resolves the active tenant from the `x-tenant-id` header, verifies that the
 * authenticated user is a member, and attaches `request.tenant` + `request.membership`.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const tenantId = request.headers[TENANT_ID_HEADER];

    if (!tenantId || Array.isArray(tenantId)) {
      throw new BadRequestException('Missing x-tenant-id header');
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId: request.user.sub },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            planId: true,
            onboardingStatus: true,
            status: true,
            timezone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this tenant');
    }

    if (membership.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Tenant is ${membership.tenant.status.toLowerCase().replace('_', ' ')}. ` +
          'Contact support to restore access.',
      );
    }

    request.tenant = membership.tenant;
    request.membership = membership;
    return true;
  }
}
