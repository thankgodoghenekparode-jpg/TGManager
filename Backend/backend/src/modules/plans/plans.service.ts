import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_PLANS = [
  {
    name: 'Free',
    code: 'free',
    priceCents: 0,
    maxBranches: 1,
    maxStaff: 10,
    featureFlags: { chat: true, workflows: true, reports: true },
  },
  {
    name: 'Pro',
    code: 'pro',
    priceCents: 4900,
    maxBranches: 5,
    maxStaff: 100,
    featureFlags: {
      chat: true,
      workflows: true,
      reports: true,
      inventory: true,
    },
  },
  {
    name: 'Enterprise',
    code: 'enterprise',
    priceCents: 14900,
    maxBranches: null,
    maxStaff: null,
    featureFlags: {
      chat: true,
      workflows: true,
      reports: true,
      inventory: true,
    },
  },
] as const;

@Injectable()
export class PlansService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureDefaultPlans();
  }

  async ensureDefaultPlans(): Promise<void> {
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          priceCents: plan.priceCents,
          maxBranches: plan.maxBranches,
          maxStaff: plan.maxStaff,
          featureFlags: plan.featureFlags,
        },
        create: {
          name: plan.name,
          code: plan.code,
          priceCents: plan.priceCents,
          maxBranches: plan.maxBranches,
          maxStaff: plan.maxStaff,
          featureFlags: plan.featureFlags,
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
}
