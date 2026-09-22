import { api } from './client'

/** Public 3-tier pricing payload served by GET /plans. */
export interface CatalogPlan {
  code: string
  name: string
  priceCents: number
  pricePerSeatCents: number | null
  billingCycle: string
  highlight: string | null
  features: string[]
  limits: {
    maxBranches: number | null
    maxStaff: number | null
    maxDocuments: number | null
    maxStorageBytes: string | null
    maxChatMessages: number | null
  }
}

export interface BillingStatus {
  plan: { code: string; name: string; priceCents: number } | null
  status: string | null
  hasStripeSubscription: boolean
  credits: Record<string, number>
}

export const billingApi = {
  catalog() {
    return api.get<CatalogPlan[]>('/plans').then((r) => r.data)
  },
  status() {
    return api.get<BillingStatus>('/billing').then((r) => r.data)
  },
  checkout(planCode: string) {
    return api
      .post<{ url: string; sessionId: string }>('/billing/checkout', { planCode })
      .then((r) => r.data)
  },
}

export function formatPriceCents(cents: number): string {
  if (cents === 0) return '$0'
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

/** Renders a credit bucket in a human-friendly unit (storage is in MB). */
export function formatCredits(kind: string, amount: number): string {
  if (kind === 'storage') {
    if (amount === 0) return '0 GB'
    if (amount >= 1024) return `${(amount / 1024).toFixed(1)} GB`
    return `${amount} MB`
  }
  return new Intl.NumberFormat('en-US').format(amount)
}

export const CREDIT_LABELS: Record<string, string> = {
  push: 'Push notifications',
  email: 'Emails',
  sms: 'SMS',
  storage: 'Storage credits',
}