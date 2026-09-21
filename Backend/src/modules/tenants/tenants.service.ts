import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../rbac/system-roles/system-roles.constants';

export interface CreateTenantWithAdminParams {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  companyName: string;
  planCode?: string;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  /**
   * Creates a company (tenant), the admin user who registered it, and seeds the
   * system company roles. Runs in a single transaction.
   */
  async createTenantWithAdmin(params: CreateTenantWithAdminParams) {
    const plan = params.planCode
      ? await this.plansService.findByCode(params.planCode)
      : await this.plansService.findByCode('free');
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Unknown or inactive plan');
    }

    const slug = await this.generateUniqueSlug(params.companyName);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: params.email.toLowerCase(),
          passwordHash: params.passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          role: 'COMPANY_ADMIN',
        },
      });

      const tenant = await tx.tenant.create({
        data: { name: params.companyName, slug, planId: plan.id },
      });

      await tx.tenantUser.create({
        data: { tenantId: tenant.id, userId: user.id },
      });

      const adminRole = await tx.companyRole.create({
        data: {
          tenantId: tenant.id,
          name: SYSTEM_ROLE_NAMES.COMPANY_ADMIN,
          description: SYSTEM_ROLE_DEFS.COMPANY_ADMIN.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.COMPANY_ADMIN.permissions],
          createdByUserId: user.id,
        },
      });

      await tx.companyRole.create({
        data: {
          tenantId: tenant.id,
          name: SYSTEM_ROLE_NAMES.BRANCH_ADMIN,
          description: SYSTEM_ROLE_DEFS.BRANCH_ADMIN.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.BRANCH_ADMIN.permissions],
          createdByUserId: user.id,
        },
      });

      await tx.companyRole.create({
        data: {
          tenantId: tenant.id,
          name: SYSTEM_ROLE_NAMES.DEPARTMENT_MANAGER,
          description: SYSTEM_ROLE_DEFS.DEPARTMENT_MANAGER.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.DEPARTMENT_MANAGER.permissions],
          createdByUserId: user.id,
        },
      });

      await tx.companyRole.create({
        data: {
          tenantId: tenant.id,
          name: SYSTEM_ROLE_NAMES.STAFF,
          description: SYSTEM_ROLE_DEFS.STAFF.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.STAFF.permissions],
          createdByUserId: user.id,
        },
      });

      await tx.roleAssignment.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          companyRoleId: adminRole.id,
          assignedByUserId: user.id,
        },
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'TRIAL',
        },
      });

      await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Branch',
          address: 'Headquarters',
          latitude: 0,
          longitude: 0,
          radiusMeters: 200,
          status: 'ACTIVE',
        },
      });

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { onboardingStatus: 'BRANCH_CREATED' },
      });

      return { user, tenant };
    });
  }

  async getMyTenants(userId: string) {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            onboardingStatus: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const tenantIds = memberships.map((m) => m.tenantId);
    const assignments = tenantIds.length
      ? await this.prisma.roleAssignment.findMany({
          where: { tenantId: { in: tenantIds }, userId },
          include: {
            companyRole: {
              select: { id: true, name: true, isSystem: true, branchId: true },
            },
          },
        })
      : [];

    return memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      status: m.tenant.status,
      onboardingStatus: m.tenant.onboardingStatus,
      plan: m.tenant.plan,
      roles: assignments
        .filter((a) => a.tenantId === m.tenantId)
        .map((a) => ({
          id: a.companyRole.id,
          name: a.companyRole.name,
          isSystem: a.companyRole.isSystem,
          branchId: a.branchId,
        })),
    }));
  }

  async getCurrent(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            maxBranches: true,
            maxStaff: true,
            featureFlags: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

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

    const permissionSet = new Set<string>();
    for (const a of assignments) {
      for (const p of a.companyRole.permissions) permissionSet.add(p);
    }

    const planFlags =
      typeof tenant.plan?.featureFlags === 'object' &&
      tenant.plan.featureFlags !== null
        ? (tenant.plan.featureFlags as Record<string, boolean>)
        : {};
    const customFlags =
      typeof tenant.settings === 'object' &&
      tenant.settings !== null &&
      'featureFlags' in tenant.settings
        ? ((tenant.settings as { featureFlags?: Record<string, boolean> })
            .featureFlags ?? {})
        : {};

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      onboardingStatus: tenant.onboardingStatus,
      timezone: tenant.timezone,
      plan: tenant.plan,
      settings: tenant.settings,
      featureFlags: { ...planFlags, ...customFlags },
      permissions: [...permissionSet],
      isCompanyAdmin: assignments.some(
        (a) => a.companyRole.name === SYSTEM_ROLE_NAMES.COMPANY_ADMIN,
      ),
      roles: assignments.map((a) => ({
        id: a.companyRole.id,
        name: a.companyRole.name,
        isSystem: a.companyRole.isSystem,
        branchId: a.branchId,
        permissions: a.companyRole.permissions,
      })),
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'company';

    let slug = base;
    let counter = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }
}
