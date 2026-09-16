import { api } from './client'

export interface ApiKeyRecord {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

export interface ApiKeyCreated extends ApiKeyRecord {
  key: string
}

export interface WebhookRecord {
  id: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
  _count?: { deliveries: number }
}

export interface DeliveryRecord {
  id: string
  webhookId: string
  eventType: string
  status: 'PENDING' | 'DELIVERED' | 'FAILED'
  attempts: number
  lastError: string | null
  deliveredAt: string | null
  createdAt: string
}

export const WEBHOOK_EVENTS = [
  'workflow.instance.started',
  'workflow.step.completed',
  'workflow.instance.approved',
] as const

export const integrationsApi = {
  listApiKeys() {
    return api.get<ApiKeyRecord[]>('/integrations/api-keys').then((r) => r.data)
  },
  createApiKey(body: { name: string; permissions?: string[] }) {
    return api.post<ApiKeyCreated>('/integrations/api-keys', body).then((r) => r.data)
  },
  revokeApiKey(keyId: string) {
    return api.delete(`/integrations/api-keys/${keyId}`).then((r) => r.data)
  },
  listWebhooks() {
    return api.get<WebhookRecord[]>('/integrations/webhooks').then((r) => r.data)
  },
  createWebhook(body: { url: string; secret: string; events: string[] }) {
    return api.post<WebhookRecord>('/integrations/webhooks', body).then((r) => r.data)
  },
  removeWebhook(webhookId: string) {
    return api.delete(`/integrations/webhooks/${webhookId}`).then((r) => r.data)
  },
  listDeliveries(webhookId: string, status?: string) {
    return api
      .get<DeliveryRecord[]>(`/integrations/webhooks/${webhookId}/deliveries`, { params: status ? { status } : {} })
      .then((r) => r.data)
  },
}