export const CREDIT_KINDS = ['push', 'sms', 'email', 'storage'] as const;

export type CreditKind = (typeof CREDIT_KINDS)[number];

/**
 * Included add-on credits granted when a plan is activated.
 * `storage` credits are expressed in megabytes (beyond what the plan's
 * storage limit already covers for overage/metered use).
 */
export const PLAN_CREDITS: Record<
  string,
  Partial<Record<CreditKind, number>>
> = {
  free: { push: 1000, email: 300, sms: 0, storage: 0 },
  pro: { push: 10000, email: 3000, sms: 500, storage: 51200 },
  enterprise: { push: 100000, email: 30000, sms: 5000, storage: 512000 },
};

export const STRIPE_DEFAULT_CURRENCY = 'usd';

export const BILLING_WEBHOOK_PATH = 'billing/webhook';
