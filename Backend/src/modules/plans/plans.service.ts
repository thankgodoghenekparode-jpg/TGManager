import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Permission } from '../rbac/permissions/permissions.constants';
import {
  PLAN_TIERS,
  PLAN_BY_CODE,
  planAllows,
  tierFeatureFlags,
} from './plans.catalog';

@Injectable()
export class PlansService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureDefaultPlans();
  }

  async ensureDefaultPlans(): Promise<void> {
    for (const tier of PLAN_TIERS) {
      await this.prisma.plan.upsert({
        where: { code: tier.code },
        update: {
          name: tier.name,
          priceCents: tier.priceCents,
          maxBranches: tier.maxBranches,
          maxStaff: tier.maxStaff,
          maxDocuments: tier.maxDocuments,
          maxStorageBytes: tier.maxStorageBytes,
          maxChatMessages: tier.maxChatMessages,
          featureFlags: tierFeatureFlags(tier) as Prisma.InputJsonValue,
        },
        create: {
          name: tier.name,
          code: tier.code,
          priceCents: tier.priceCents,
          maxBranches: tier.maxBranches,
          maxStaff: tier.maxStaff,
          maxDocuments: tier.maxDocuments,
          maxStorageBytes: tier.maxStorageBytes,
          maxChatMessages: tier.maxChatMessages,
          featureFlags: tierFeatureFlags(tier) as Prisma.InputJsonValue,
        },
      });
    }
    this.logger.log('Ensured default plans exist');
  }

  listActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  findByCode(code: string) {
    return this.prisma.plan.findUnique({ where: { code } });
  }

  /**
   * Public 3-tier pricing payload for the pricing page / checkout. Driven by
   * the catalog (single source of truth) so copy stays consistent.
   */
  getCatalog() {
    return PLAN_TIERS.map((tier) => ({
      code: tier.code,
      name: tier.name,
      priceCents: tier.priceCents,
      pricePerSeatCents: tier.pricePerSeatCents,
      billingCycle: tier.billingCycle,
      highlight: tier.highlight ?? null,
      features: [...tier.features],
      limits: {
        maxBranches: tier.maxBranches,
        maxStaff: tier.maxStaff,
        maxDocuments: tier.maxDocuments,
        maxStorageBytes: tier.maxStorageBytes?.toString() ?? null,
        maxChatMessages: tier.maxChatMessages,
      },
    }));
  }

  /** Whether a catalog insight version of a plan grants a company permission. */
  allowsPlanRow(
    plan: { code: string; featureFlags: Prisma.JsonValue | null | undefined },
    permission: Permission,
  ): boolean {
    return planAllows(plan, permission);
  }

  allowsCode(code: string, permission: Permission): boolean {
    const tier = PLAN_BY_CODE.get(code);
    return tier ? tier.permissions.includes(permission) : true;
  }
}
