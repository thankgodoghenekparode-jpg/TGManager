import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

describe('BillingService', () => {
  let service: BillingService;
  let stripe: { createCustomer: jest.Mock; createCheckoutSession: jest.Mock };
  let prisma: {
    tenantSubscription: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    plan: { findUnique: jest.Mock };
    tenant: { findUnique: jest.Mock; update: jest.Mock };
    tenantUser: { findFirst: jest.Mock };
    creditTransaction: { create: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const proPlan = {
    id: 'p_pro',
    code: 'pro',
    name: 'Pro',
    priceCents: 4900,
    isActive: true,
  };
  const freePlan = {
    id: 'p_free',
    code: 'free',
    name: 'Free',
    priceCents: 0,
    isActive: true,
  };

  const subRow = (overrides: Record<string, unknown> = {}) => ({
    id: 's1',
    tenantId: 't1',
    planId: 'p_free',
    status: 'TRIAL',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    credits: {},
    ...overrides,
  });

  beforeEach(async () => {
    stripe = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
    };
    prisma = {
      tenantSubscription: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      plan: { findUnique: jest.fn() },
      tenant: { findUnique: jest.fn(), update: jest.fn() },
      tenantUser: { findFirst: jest.fn() },
      creditTransaction: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => ops),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        {
          provide: ConfigService,
          useValue: { get: () => 'https://app.example' },
        },
      ],
    }).compile();

    service = moduleRef.get(BillingService);
  });

  describe('startCheckout', () => {
    it('creates a Stripe customer from the first tenant user email', async () => {
      prisma.plan.findUnique.mockResolvedValue(proPlan);
      prisma.tenantSubscription.findFirst.mockResolvedValue(subRow());
      prisma.tenantUser.findFirst.mockResolvedValue({
        user: { email: 'owner@example.com' },
      });
      prisma.tenantSubscription.update.mockImplementation(() =>
        subRow({ stripeCustomerId: 'cus_new' }),
      );
      stripe.createCustomer.mockResolvedValue({ id: 'cus_new' });
      stripe.createCheckoutSession.mockResolvedValue({
        id: 'cs_1',
        url: 'https://checkout.stripe.com/c/pay/cs_1',
      });

      const result = await service.startCheckout('t1', 'pro');

      expect(stripe.createCustomer).toHaveBeenCalledWith('owner@example.com');
      expect(result.url).toBe('https://checkout.stripe.com/c/pay/cs_1');
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_new',
          planName: 'Pro',
          priceCents: 4900,
          metadata: { tenantId: 't1', planCode: 'pro' },
        }),
      );
    });

    it('rejects inactive plans', async () => {
      prisma.plan.findUnique.mockResolvedValue({ ...proPlan, isActive: false });
      await expect(service.startCheckout('t1', 'pro')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('upgrades tenant, persists Stripe ids, grants plan credits, audits', async () => {
      const session = {
        id: 'cs_1',
        customer: 'cus_1',
        subscription: 'sub_1',
        metadata: { tenantId: 't1', planCode: 'pro' },
      } as never;

      prisma.plan.findUnique.mockResolvedValue(proPlan);
      prisma.tenantSubscription.findFirst.mockResolvedValue(subRow());
      prisma.tenantSubscription.findUnique.mockResolvedValue(subRow());
      prisma.tenantSubscription.update.mockImplementation(
        (args: { data: Record<string, unknown> }) => subRow(args.data),
      );

      await service.handleCheckoutCompleted(session);

      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({
          planId: 'p_pro',
          status: 'ACTIVE',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
        }),
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { planId: 'p_pro' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'billing.checkout_completed',
            entityType: 'TenantSubscription',
            metadata: expect.objectContaining({ plan: 'pro' }),
          }),
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      // rollout of the full Pro credit set
      const creates = prisma.creditTransaction.create.mock.calls.map(
        (c: { data: { kind: string; delta: number } }[]) => c[0].data,
      );
      expect(creates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'push', delta: 10000 }),
          expect.objectContaining({ kind: 'sms', delta: 500 }),
        ]),
      );
    });

    it('throws when metadata is missing', async () => {
      await expect(
        service.handleCheckoutCompleted({ id: 'cs_1', metadata: {} } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('cancels the subscription and downgrades the tenant to free', async () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(subRow());
      prisma.tenantSubscription.findUnique.mockResolvedValue(subRow());
      prisma.plan.findUnique.mockResolvedValue(freePlan);

      await service.handleSubscriptionDeleted({ id: 'sub_1' } as never);

      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { planId: 'p_free' },
      });
    });
  });

  describe('consumeCredit', () => {
    it('debts the bucket and records a negative transaction', async () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(
        subRow({ credits: { push: 100 } }),
      );
      const ok = await service.consumeCredit('t1', 'push', 25);
      expect(ok).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { credits: expect.objectContaining({ push: 75 }) },
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'push',
          delta: -25,
          reason: 'usage',
        }),
      });
    });

    it('refuses when the balance is insufficient', async () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(
        subRow({ credits: { push: 5 } }),
      );
      expect(await service.consumeCredit('t1', 'push', 25)).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('grantCredits', () => {
    it('adds to the existing balance', async () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(
        subRow({ credits: { push: 100 } }),
      );
      await service.grantCredits('t1', 'push', 50, 'promo', 'PROMO10');
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'push',
          delta: 50,
          reason: 'promo',
          ref: 'PROMO10',
        }),
      });
      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { credits: expect.objectContaining({ push: 150 }) },
      });
    });
  });
});
