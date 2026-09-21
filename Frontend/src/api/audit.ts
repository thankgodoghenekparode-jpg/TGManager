import { api, type Paged } from './client'

export interface AuditLog {
  id: string
  tenantId: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  user?: { id: string; firstName: string; lastName: string; email: string } | null
}

export interface ListAuditQuery {
  entityType?: string
  action?: string
  userId?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

export const auditApi = {
  list(query: ListAuditQuery = {}) {
    return api.get<Paged<AuditLog>>('/audit', { params: query }).then((r) => r.data)
  },
}