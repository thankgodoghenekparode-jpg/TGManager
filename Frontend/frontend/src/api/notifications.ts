import { api } from './client'

export interface AppNotification {
  id: string
  tenantId: string
  userId: string
  type: string
  title: string
  body: string | null
  readAt: string | null
  createdAt: string
  data?: Record<string, unknown>
}

export const notificationsApi = {
  list(limit = 50) {
    return api
      .get<AppNotification[]>('/notifications', { params: { limit } })
      .then((r) => r.data)
  },
  unreadCount() {
    return api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data)
  },
  markRead(id: string) {
    return api.post<AppNotification>(`/notifications/${id}/read`).then((r) => r.data)
  },
  markAllRead() {
    return api.post<{ updated: number }>('/notifications/read-all').then((r) => r.data)
  },
}