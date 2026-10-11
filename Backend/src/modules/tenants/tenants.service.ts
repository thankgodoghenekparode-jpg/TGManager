import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { StorageService } from '../storage/storage.service';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../rbac/system-roles/system-roles.constants';

/** Accepted image MIME types for tenant logos. */
const LOGO_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface CreateTenantWithAdminParams {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  companyName: string;
  planCode?: string;
  type?: 'COMPANY' | 'SCHOOL';
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly storage: StorageService,
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
        data: {
          name: params.companyName,
          slug,
          planId: plan.id,
          type: params.type ?? 'COMPANY',
        },
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

      if (params.type === 'SCHOOL') {
        const schoolRoles = [
          SYSTEM_ROLE_DEFS.PRINCIPAL,
          SYSTEM_ROLE_DEFS.TEACHER,
          SYSTEM_ROLE_DEFS.ACCOUNTANT,
          SYSTEM_ROLE_DEFS.GATE_OFFICER,
          SYSTEM_ROLE_DEFS.PARENT,
        ];
        for (const r of schoolRoles) {
          await tx.companyRole.create({
            data: {
              tenantId: tenant.id,
              name: r.name,
              description: r.description,
              isSystem: true,
              permissions: [...r.permissions],
              createdByUserId: user.id,
            },
          });
        }

        await tx.schoolProfile.create({
          data: {
            tenantId: tenant.id,
            principalName: `${params.firstName} ${params.lastName}`,
            schoolType: 'SECONDARY',
            currency: 'NGN',
            address: 'Main Campus',
          },
        });
      }

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
            type: true,
            logoKey: true,
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
      type: m.tenant.type,
      logoKey: m.tenant.logoKey,
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
        schoolProfile: true,
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
      type: tenant.type,
      logoKey: tenant.logoKey,
      status: tenant.status,
      onboardingStatus: tenant.onboardingStatus,
      timezone: tenant.timezone,
      plan: tenant.plan,
      settings: tenant.settings,
      schoolProfile: tenant.schoolProfile,
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

  /**
   * Stores a tenant logo and returns the new storage key. Rejects anything but
   * PNG/JPEG/WebP and removes the previous logo to avoid orphaned files.
   */
  async uploadLogo(tenantId: string, file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('A logo file is required');
    }
    const ext = LOGO_MIME_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be smaller than 2 MB');
    }

    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoKey: true },
    });
    if (!existing) {
      throw new BadRequestException('Tenant not found');
    }

    const key = `logos/${tenantId}/${randomUUID()}.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoKey: key },
      select: { logoKey: true },
    });

    if (existing.logoKey && existing.logoKey !== key) {
      await this.storage.deleteObject(existing.logoKey).catch(() => {
        // Ignore a missing old logo at cleanup time.
      });
    }

    return tenant;
  }

  /** Removes the tenant logo and its stored file, reverting to the default brand. */
  async deleteLogo(tenantId: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoKey: true },
    });
    if (!existing) {
      throw new BadRequestException('Tenant not found');
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoKey: null },
    });
    if (existing.logoKey) {
      await this.storage.deleteObject(existing.logoKey).catch(() => {
        // Ignore a missing old logo at cleanup time.
      });
    }
  }

  /** Streams the tenant logo bytes and its MIME type, or null when unset. */
  async getLogo(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoKey: true },
    });
    if (!tenant?.logoKey) {
      return null;
    }
    const buffer = await this.storage.getObject(tenant.logoKey);
    const ext = tenant.logoKey.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    return { buffer, mimeType };
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
