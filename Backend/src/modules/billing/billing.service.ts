import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '../../generated/prisma/enums';
import { CREDIT_KINDS, CreditKind, PLAN_CREDITS } from './billing.constants';
import {
  StripeCheckoutSession,
  StripeService,
  StripeSubscription,
} from './stripe.service';

type Credits = Record<string, number>;

function mapStripeStatus(status: string): SubscriptionStatus {
  if (status === 'trialing') return SubscriptionStatus.TRIAL;
  if (status === 'active') return SubscriptionStatus.ACTIVE;
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
    return SubscriptionStatus.PAST_DUE;
  }
  if (status === 'canceled') return SubscriptionStatus.CANCELLED;
  return SubscriptionStatus.EXPIRED;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(tenantId: string) {
    const subscription = await this.latestSubscription(tenantId);
    const plan = await this.prisma.plan.findUnique({
      where: { id: subscription?.planId ?? '' },
    });
    return {
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            priceCents: plan.priceCents,
          }
        : null,
      status: subscription?.status ?? null,
      hasStripeSubscription: Boolean(subscription?.stripeSubscriptionId),
      credits: (subscription?.credits ?? {}) as Credits,
    };
  }

  /**
   * Starts a Stripe Checkout subscription session for the given plan.
   * Returns the hosted checkout URL the frontend redirects to.
   */
  async startCheckout(tenantId: string, planCode: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException('Plan not available');
    }

    let subscription = await this.latestSubscription(tenantId);
    if (!subscription) {
      subscription = await this.prisma.tenantSubscription.create({
        data: { tenantId, planId: plan.id, status: 'TRIAL' },
      });
    }

    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const email = await this.lookupTenantEmail(tenantId);
      const customer = await this.stripe.createCustomer(email);
      customerId = customer.id;
      subscription = await this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const session = await this.stripe.createCheckoutSession({
      customerId,
      planName: plan.name,
      priceCents: plan.priceCents,
      successUrl: `${frontendUrl}/settings/billing?checkout=success`,
      cancelUrl: `${frontendUrl}/settings/billing?checkout=cancelled`,
      metadata: { tenantId, planCode: plan.code },
    });

    return { url: session.url, sessionId: session.id };
  }

  async handleCheckoutCompleted(session: StripeCheckoutSession) {
    const tenantId = session.metadata?.tenantId;
    const planCode = session.metadata?.planCode;
    if (!tenantId || !planCode) {
      throw new BadRequestException('Checkout session missing metadata');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    let subscription = await this.latestSubscription(tenantId);
    if (!subscription) {
      subscription = await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        },
      });
    } else {
      subscription = await this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          stripeCustomerId: session.customer ?? subscription.stripeCustomerId,
          stripeSubscriptionId:
            session.subscription ?? subscription.stripeSubscriptionId,
        },
      });
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id },
    });

    await this.applyPlanCredits(
      tenantId,
      subscription.id,
      plan.code,
      'plan_checkout',
      session.id,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: 'billing.checkout_completed',
        entityType: 'TenantSubscription',
        entityId: subscription.id,
        metadata: {
          plan: plan.code,
          stripeSubscriptionId: session.subscription,
        },
      },
    });
  }

  async handleSubscriptionUpdated(sub: StripeSubscription) {
    const current = await this.findByStripeSubscription(sub.id);
    if (!current) return;

    await this.prisma.tenantSubscription.update({
      where: { id: current.id },
      data: { status: mapStripeStatus(sub.status) },
    });

    const planCode = sub.metadata?.planCode;
    if (planCode) {
      const plan = await this.prisma.plan.findUnique({
        where: { code: planCode },
      });
      if (plan) {
        await this.prisma.tenant.update({
          where: { id: current.tenantId },
          data: { planId: plan.id },
        });
        await this.applyPlanCredits(
          current.tenantId,
          current.id,
          plan.code,
          'plan_updated',
          sub.id,
        );
      }
    }
  }

  async handleSubscriptionDeleted(sub: StripeSubscription) {
    const current = await this.findByStripeSubscription(sub.id);
    if (!current) return;

    await this.prisma.tenantSubscription.update({
      where: { id: current.id },
      data: { status: 'CANCELLED' },
    });

    const freePlan = await this.prisma.plan.findUnique({
      where: { code: 'free' },
    });
    if (freePlan) {
      await this.prisma.tenant.update({
        where: { id: current.tenantId },
        data: { planId: freePlan.id },
      });
    }
    await this.applyPlanCredits(
      current.tenantId,
      current.id,
      'free',
      'plan_cancelled',
      sub.id,
    );
  }

  getCreditBalance(tenantId: string): Promise<Credits> {
    return this.latestSubscription(tenantId).then(
      (subscription) => (subscription?.credits ?? {}) as Credits,
    );
  }

  /**
   * Decrements a credit bucket. Returns false (and records nothing) when
   * the tenant has insufficient credits for the requested amount.
   */
  async consumeCredit(
    tenantId: string,
    kind: CreditKind,
    amount: number,
    reason = 'usage',
  ): Promise<boolean> {
    if (
      !CREDIT_KINDS.includes(kind) ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return false;
    }
    const subscription = await this.latestSubscription(tenantId);
    if (!subscription) return false;

    const credits = { ...((subscription.credits ?? {}) as Credits) };
    const available = credits[kind] ?? 0;
    if (available < amount) return false;

    credits[kind] = available - amount;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: { credits },
      }),
      this.prisma.creditTransaction.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          kind,
          delta: -amount,
          reason,
        },
      }),
    ]);
    return true;
  }

  /** Grants credits (used for promos/top-ups). */
  async grantCredits(
    tenantId: string,
    kind: CreditKind,
    amount: number,
    reason: string,
    ref?: string,
  ): Promise<void> {
    if (
      !CREDIT_KINDS.includes(kind) ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return;
    }
    const subscription = await this.latestSubscription(tenantId);
    if (!subscription) return;

    const credits = { ...((subscription.credits ?? {}) as Credits) };
    credits[kind] = (credits[kind] ?? 0) + amount;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: { credits },
      }),
      this.prisma.creditTransaction.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          kind,
          delta: amount,
          reason,
          ref,
        },
      }),
    ]);
  }

  private async applyPlanCredits(
    tenantId: string,
    subscriptionId: string,
    planCode: string,
    reason: string,
    ref?: string,
  ): Promise<void> {
    const current = await this.prisma.tenantSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!current) return;

    const credits = { ...((current.credits ?? {}) as Credits) };
    const target = PLAN_CREDITS[planCode] ?? {};
    const nextCredits: Credits = { ...credits };
    const transactions = [];

    for (const kind of CREDIT_KINDS) {
      const oldValue = credits[kind] ?? 0;
      const targetValue = target[kind] ?? 0;
      if (targetValue === oldValue) continue;
      nextCredits[kind] = targetValue;
      transactions.push({
        tenantId,
        subscriptionId,
        kind,
        delta: targetValue - oldValue,
        reason,
        ref,
      });
    }

    if (transactions.length === 0) return;
    await this.prisma.$transaction([
      this.prisma.tenantSubscription.update({
        where: { id: subscriptionId },
        data: { credits: nextCredits },
      }),
      ...transactions.map((data) =>
        this.prisma.creditTransaction.create({ data }),
      ),
    ]);
  }

  private async latestSubscription(tenantId: string) {
    return this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findByStripeSubscription(stripeSubscriptionId: string) {
    return this.prisma.tenantSubscription.findFirst({
      where: { stripeSubscriptionId },
    });
  }

  private async lookupTenantEmail(tenantId: string): Promise<string> {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { tenantId },
      include: { user: true },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    return (
      tenantUser?.user?.email ?? `${tenant?.slug ?? 'tenant'}@tgmanager.app`
    );
  }
}
