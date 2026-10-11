import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { AuditService } from '../audit/audit.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { TenantsService } from '../tenants/tenants.service';
import { PasswordResetService } from '../auth/password-reset.service';
import type {
  PlatformSettingsDto,
  PlatformSettingsShape,
} from './dto/platform-settings.dto';
import { parsePlatformSettings } from './dto/platform-settings.dto';
import type {
  CreatePlanDto,
  CreatePlatformUserDto,
  CreateTenantDto,
  ListPlatformUsersDto,
  ListTenantsDto,
  SetTenantAccessDto,
  UpdatePlanDto,
  UpdatePlatformUserDto,
  UpdateTenantDto,
} from './dto/platform.dto';

const PLATFORM_ROLES = new Set(['SUPER_ADMIN', 'PLATFORM_SUPPORT']);

const BCRYPT_ROUNDS = 10;

function toBigIntNullable(value?: number | null): bigint | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : BigInt(value);
}

function toIntNullable(value?: number | null): number | null | undefined {
  if (value === undefined) return undefined;
  return value;
}

function sanitizeUser<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly audit: AuditService,
    private readonly tenants: TenantsService,
    private readonly passwordReset: PasswordResetService,
    private readonly locks: DistributedLockService,
  ) {}

  // ---------------------------------------------------------------- plans

  listPlans() {
    return this.prisma.plan.findMany({
      orderBy: { priceCents: 'asc' },
    });
  }

  async createPlan(dto: CreatePlanDto) {
    try {
      return await this.prisma.plan.create({
        data: {
          name: dto.name,
          code: dto.code.toLowerCase(),
          priceCents: dto.priceCents,
          maxBranches: toIntNullable(dto.maxBranches),
          maxStaff: toIntNullable(dto.maxStaff),
          maxDocuments: toIntNullable(dto.maxDocuments),
          maxStorageBytes: toBigIntNullable(dto.maxStorageBytes),
          maxChatMessages: toIntNullable(dto.maxChatMessages),
          featureFlags: dto.featureFlags ?? {},
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A plan with this code already exists');
      }
      throw error;
    }
  }

  async updatePlan(planId: string, dto: UpdatePlanDto) {
    await this.assertPlanExists(planId);
    try {
      return await this.prisma.plan.update({
        where: { id: planId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.code !== undefined ? { code: dto.code.toLowerCase() } : {}),
          ...(dto.priceCents !== undefined
            ? { priceCents: dto.priceCents }
            : {}),
          ...(dto.maxBranches !== undefined
            ? { maxBranches: toIntNullable(dto.maxBranches) }
            : {}),
          ...(dto.maxStaff !== undefined
            ? { maxStaff: toIntNullable(dto.maxStaff) }
            : {}),
          ...(dto.maxDocuments !== undefined
            ? { maxDocuments: toIntNullable(dto.maxDocuments) }
            : {}),
          ...(dto.maxStorageBytes !== undefined
            ? { maxStorageBytes: toBigIntNullable(dto.maxStorageBytes) }
            : {}),
          ...(dto.maxChatMessages !== undefined
            ? { maxChatMessages: toIntNullable(dto.maxChatMessages) }
            : {}),
          ...(dto.featureFlags !== undefined
            ? { featureFlags: dto.featureFlags }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A plan with this code already exists');
      }
      throw error;
    }
  }

  async deactivatePlan(planId: string): Promise<void> {
    const plan = await this.assertPlanExists(planId);
    if (!plan.isActive) {
      throw new BadRequestException('Plan is already inactive');
    }
    const tenantsUsing = await this.prisma.tenant.count({
      where: { planId },
    });
    if (tenantsUsing > 0) {
      throw new BadRequestException(
        `${tenantsUsing} tenant(s) are still on this plan. Reassign them before deactivating.`,
      );
    }
    await this.prisma.plan.update({
      where: { id: planId },
      data: { isActive: false },
    });
  }

  // ---------------------------------------------------------------- tenants

  async listTenants(query: ListTenantsDto) {
    const where: Prisma.TenantWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          plan: {
            select: { id: true, name: true, code: true, featureFlags: true },
          },
          tenantUsers: {
            where: { user: { role: 'COMPANY_ADMIN' } },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { id: true, email: true } } },
          },
          subscriptions: {
            orderBy: { startsAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              startsAt: true,
              endsAt: true,
            },
          },
          _count: {
            select: {
              tenantUsers: true,
              branches: true,
              staffRecords: true,
              documents: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: items.map(({ tenantUsers, subscriptions, ...tenant }) => {
        const latest = subscriptions[0] ?? null;
        return {
          ...tenant,
          adminEmail: tenantUsers[0]?.user.email ?? null,
          adminUserId: tenantUsers[0]?.user.id ?? null,
          subscription: latest,
          accessExpiresAt: latest?.endsAt?.toISOString() ?? null,
          accessExpired:
            latest?.endsAt != null &&
            latest.endsAt.getTime() <= Date.now(),
        };
      }),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          orderBy: { startsAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
        _count: {
          select: {
            tenantUsers: true,
            branches: true,
            departments: true,
            groups: true,
            staffRecords: true,
            documents: true,
            inventoryItems: true,
            memos: true,
            forms: true,
            workflowTemplates: true,
            conversations: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const { subscriptions, ...rest } = tenant;
    const latest = subscriptions[0] ?? null;
    return {
      ...rest,
      subscription: latest,
      accessExpiresAt: latest?.endsAt?.toISOString() ?? null,
      accessExpired: latest?.endsAt != null && latest.endsAt.getTime() <= Date.now(),
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    await this.assertTenantExists(tenantId);
    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
    }
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.planId !== undefined ? { planId: dto.planId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.onboardingStatus !== undefined
          ? { onboardingStatus: dto.onboardingStatus }
          : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.settings !== undefined
          ? { settings: dto.settings as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async suspendTenant(tenantId: string, actorUserId: string, ip?: string) {
    await this.assertTenantExists(tenantId);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
    });
    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'PLATFORM.SUSPEND_TENANT',
      entityType: 'TENANT',
      entityId: tenantId,
      metadata: { name: updated.name },
      ip,
    });
    return updated;
  }

  async activateTenant(tenantId: string, actorUserId: string, ip?: string) {
    await this.assertTenantExists(tenantId);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE' },
    });

    // If the tenant's latest access window has already elapsed, clear it so the
    // reactivation actually grants access (otherwise the guard would keep
    // blocking and the hourly sweep would re-suspend within the hour).
    const latest = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { startsAt: 'desc' },
    });
    if (latest?.endsAt && latest.endsAt.getTime() <= Date.now()) {
      await this.prisma.tenantSubscription.update({
        where: { id: latest.id },
        data: { endsAt: null, status: 'ACTIVE' },
      });
    }

    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'PLATFORM.ACTIVATE_TENANT',
      entityType: 'TENANT',
      entityId: tenantId,
      metadata: { name: updated.name },
      ip,
    });
    return updated;
  }

  /**
   * Grant / extend / clear a tenant's access window.
   * - A future `endsAt` (or `durationDays`) sets the expiry: the tenant stays
   *   active until that moment, then the access-expiry sweep marks it TRIAL_ENDED.
   * - `endsAt: null` clears the expiry (unlimited access).
   * Granting access always reactivates a lapsed tenant, so the same endpoint
   * is the single "give access again" action for the super admin.
   */
  async setTenantAccess(
    tenantId: string,
    dto: SetTenantAccessDto,
    actorUserId: string,
    ip?: string,
  ) {
    const tenant = await this.assertTenantExists(tenantId);

    let endsAt: Date | null;
    if (dto.durationDays !== undefined) {
      endsAt = new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000);
    } else if (dto.endsAt !== undefined) {
      endsAt = dto.endsAt === null ? null : new Date(dto.endsAt);
    } else {
      throw new BadRequestException(
        'Provide exactly one of endsAt or durationDays',
      );
    }

    if (endsAt && endsAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'endsAt must be in the future — use null to clear the expiry, or a future date',
      );
    }

    // Reuse the tenant's latest access window when one exists; otherwise
    // create the first one. Editing the same row keeps the "latest window"
    // rule in the TenantGuard unambiguous.
    const latest = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { startsAt: 'desc' },
    });
    const subscription = latest
      ? await this.prisma.tenantSubscription.update({
          where: { id: latest.id },
          data: { startsAt: new Date(), endsAt, status: 'ACTIVE' },
        })
      : await this.prisma.tenantSubscription.create({
          data: {
            tenantId,
            planId: tenant.planId,
            startsAt: new Date(),
            endsAt,
            status: 'ACTIVE',
          },
        });

    // Granting access always reactivates the tenant.
    if (tenant.status !== 'ACTIVE') {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    this.audit.record(tenantId, {
      userId: actorUserId,
      action: 'PLATFORM.SET_TENANT_ACCESS',
      entityType: 'TENANT',
      entityId: tenantId,
      metadata: {
        name: tenant.name,
        endsAt: endsAt?.toISOString() ?? null,
        durationDays: dto.durationDays ?? null,
      },
      ip,
    });

    return {
      tenantId,
      status: 'ACTIVE' as const,
      accessExpiresAt: endsAt?.toISOString() ?? null,
      subscription,
    };
  }

  /**
   * Automatic enforcement, guarded by a distributed lock so only one instance
   * sweeps in a multi-instance deployment. Flips ACTIVE tenants whose latest
   * access window has elapsed to TRIAL_ENDED so they are hard-blocked by the
   * TenantGuard and clearly visible to the super admin. Granting access again
   * reactivates them. (The TenantGuard also denies requests inline, so this
   * sweep only keeps the stored status consistent between hourly runs.)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpiredAccess(): Promise<void> {
    await this.locks.runOnce('tenant-access-expiry', 55 * 60_000, () =>
      this.expireLapsedTenants(),
    );
  }

  /** Marks ACTIVE tenants whose latest access window has elapsed as TRIAL_ENDED. */
  async expireLapsedTenants(): Promise<{
    evaluated: number;
    suspended: number;
  }> {
    try {
      const now = new Date();
      const candidates = await this.prisma.tenant.findMany({
        where: {
          status: 'ACTIVE',
          subscriptions: { some: { endsAt: { lt: now } } },
        },
        select: {
          id: true,
          name: true,
          subscriptions: {
            orderBy: { startsAt: 'desc' },
            take: 1,
            select: { endsAt: true },
          },
        },
      });

      const expired = candidates.filter((candidate) => {
        const latest = candidate.subscriptions[0];
        return (
          latest?.endsAt != null && latest.endsAt.getTime() <= now.getTime()
        );
      });

      for (const tenant of expired) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: 'TRIAL_ENDED' },
        });
        this.logger.warn(
          `Tenant "${tenant.name}" (${tenant.id}) access window ended; marked TRIAL_ENDED.`,
        );
        this.audit.record(tenant.id, {
          action: 'TENANT.ACCESS_EXPIRED',
          entityType: 'TENANT',
          entityId: tenant.id,
          metadata: { name: tenant.name },
        });
      }

      if (expired.length > 0) {
        this.logger.log(
          `Access-expiry sweep: ${expired.length} tenant(s) suspended.`,
        );
      }
      return { evaluated: candidates.length, suspended: expired.length };
    } catch (error) {
      this.logger.error(
        `Access-expiry sweep failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return { evaluated: 0, suspended: 0 };
    }
  }

  async getTenantUsage(tenantId: string) {
    const tenant = await this.assertTenantExists(tenantId);
    const plan = await this.prisma.plan.findUnique({
      where: { id: tenant.planId },
    });
    const usage = await this.planLimits.getUsage(tenantId);
    return { tenantId, usage, plan };
  }

  // ---------------------------------------------------------------- tenants: create/delete

  async createTenant(dto: CreateTenantDto) {
    const tempPassword = randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const { user, tenant } = await this.tenants.createTenantWithAdmin({
      firstName: dto.adminFirstName,
      lastName: dto.adminLastName,
      email: dto.adminEmail,
      passwordHash,
      companyName: dto.companyName,
      planCode: dto.planCode,
      type: dto.type,
    });

    return {
      tenant,
      admin: sanitizeUser(user),
      tempPassword,
    };
  }

  async deleteTenant(tenantId: string) {
    const tenant = await this.assertTenantExists(tenantId);

    const memberUserIds = (
      await this.prisma.tenantUser.findMany({
        where: { tenantId },
        select: { userId: true },
      })
    ).map((r) => r.userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.delete({ where: { id: tenantId } });
      for (const userId of memberUserIds) {
        const remaining = await tx.tenantUser.count({ where: { userId } });
        if (remaining === 0) {
          await tx.user.update({
            where: { id: userId },
            data: { isActive: false },
          });
        }
      }
    });

    this.logger.log(
      `Tenant "${tenant.name}" (${tenant.id}) deleted by platform admin; ` +
        `${memberUserIds.length} member account(s) reviewed.`,
    );

    return { ok: true, message: `Tenant "${tenant.name}" deleted` };
  }

  // ---------------------------------------------------------------- platform users

  async createPlatformUser(dto: CreatePlatformUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const tempPassword = randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });

    return {
      user: sanitizeUser(user),
      tempPassword,
    };
  }

  async listPlatformUsers(query: ListPlatformUsersDto) {
    const where: Prisma.UserWhereInput = {
      role: { in: ['SUPER_ADMIN', 'PLATFORM_SUPPORT'] },
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(sanitizeUser),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getPlatformUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!PLATFORM_ROLES.has(user.role)) {
      throw new BadRequestException('User is not a platform user');
    }
    return sanitizeUser(user);
  }

  async updatePlatformUser(userId: string, dto: UpdatePlatformUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!PLATFORM_ROLES.has(user.role)) {
      throw new BadRequestException('User is not a platform user');
    }
    if (user.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last active super administrator',
        );
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return sanitizeUser(updated);
  }

  async removePlatformUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!PLATFORM_ROLES.has(user.role)) {
      throw new BadRequestException('User is not a platform user');
    }
    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last active super administrator',
        );
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  async resetPlatformUserPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!PLATFORM_ROLES.has(user.role)) {
      throw new BadRequestException('User is not a platform user');
    }

    const result = await this.passwordReset.issueAndEmailForUser(
      user.id,
      user.email,
    );

    // Note: platform users are global (no tenant), so we skip tenant-scoped
    // audit logging here, matching updatePlatformSettings.

    return {
      message: result.sent
        ? 'Password reset link sent.'
        : 'Reset link could not be emailed (no SMTP configured); the reset token is logged server-side.',
      ...(result.token ? { temporaryToken: result.token } : {}),
    };
  }

  private readonly CONFIG_ID = 'platform';

  async getPlatformSettings(): Promise<PlatformSettingsShape> {
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: this.CONFIG_ID },
    });
    return parsePlatformSettings(config?.data);
  }

  async updatePlatformSettings(
    dto: PlatformSettingsDto,
    _userId: string,
    _ip?: string,
  ): Promise<PlatformSettingsShape> {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { id: this.CONFIG_ID },
    });

    const current = parsePlatformSettings(existing?.data);
    const next: PlatformSettingsShape = { ...current };
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (next as Record<string, unknown>)[key] = value;
      }
    }

    const config = await this.prisma.platformConfig.upsert({
      where: { id: this.CONFIG_ID },
      create: {
        id: this.CONFIG_ID,
        data: next as unknown as Prisma.InputJsonObject,
      },
      update: { data: next as unknown as Prisma.InputJsonObject },
    });

    // Note: platform settings are global (no tenant), so we skip tenant-scoped audit logging here.

    return parsePlatformSettings(config.data);
  }

  // ---------------------------------------------------------------- helpers

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return (error as { code?: unknown }).code === 'P2002';
    }
    return false;
  }

  private async assertPlanExists(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }
}
