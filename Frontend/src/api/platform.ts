import { api, type Paginated } from './client'

export interface PlatformPlan {
  id: string
  name: string
  code: string
  priceCents: number
  maxBranches: number | null
  maxStaff: number | null
  maxDocuments: number | null
  maxStorageBytes: string | null
  maxChatMessages: number | null
  featureFlags: Record<string, string | number | boolean>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlatformTenant {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL_ENDED'
  onboardingStatus: string
  timezone: string
  plan: { name: string; code: string } | null
  createdAt: string
  adminEmail: string | null
  adminUserId: string | null
}

export interface PlatformUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'PLATFORM_SUPPORT'
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export const platformApi = {
  plans() {
    return api.get<PlatformPlan[]>('/platform/plans').then((r) => r.data)
  },
  createPlan(body: Partial<PlatformPlan> & { name: string; code: string }) {
    return api.post<PlatformPlan>('/platform/plans', body).then((r) => r.data)
  },
  updatePlan(id: string, body: Partial<PlatformPlan>) {
    return api.patch<PlatformPlan>(`/platform/plans/${id}`, body).then((r) => r.data)
  },
  deactivatePlan(id: string) {
    return api.delete(`/platform/plans/${id}`).then((r) => r.data)
  },
  tenants(query?: {
    search?: string
    status?: PlatformTenant['status']
    planId?: string
    limit?: number
    offset?: number
  }) {
    return api
      .get<Paginated<PlatformTenant>>('/platform/tenants', { params: query })
      .then((r) => r.data)
  },
  getTenant(id: string) {
    return api.get<PlatformTenant>(`/platform/tenants/${id}`).then((r) => r.data)
  },
  createTenant(body: {
    companyName: string
    planCode?: string
    adminFirstName: string
    adminLastName: string
    adminEmail: string
  }) {
    return api
      .post<{
        tenant: PlatformTenant
        admin: { id: string; email: string; firstName: string; lastName: string }
        tempPassword: string
      }>('/platform/tenants', body)
      .then((r) => r.data)
  },
  deleteTenant(id: string) {
    return api.delete(`/platform/tenants/${id}`).then((r) => r.data)
  },
  updateTenant(id: string, body: Partial<PlatformTenant>) {
    return api.patch<PlatformTenant>(`/platform/tenants/${id}`, body).then((r) => r.data)
  },
  getTenantUsage(id: string) {
    return api.get(`/platform/tenants/${id}/usage`).then((r) => r.data)
  },
  suspendTenant(id: string) {
    return api.post(`/platform/tenants/${id}/suspend`).then((r) => r.data)
  },
  activateTenant(id: string) {
    return api.post(`/platform/tenants/${id}/activate`).then((r) => r.data)
  },
  users(query?: { search?: string; role?: string; limit?: number; offset?: number }) {
    return api
      .get<Paginated<PlatformUser>>('/platform/users', { params: query })
      .then((r) => r.data)
  },
  getUser(id: string) {
    return api.get<PlatformUser>(`/platform/users/${id}`).then((r) => r.data)
  },
  createUser(body: { email: string; firstName: string; lastName: string; role: string }) {
    return api
      .post<PlatformUser & { temporaryPassword?: string }>('/platform/users', body)
      .then((r) => r.data)
  },
  updateUser(
    id: string,
    body: { firstName?: string; lastName?: string; role?: string; isActive?: boolean },
  ) {
    return api.patch<PlatformUser>(`/platform/users/${id}`, body).then((r) => r.data)
  },
  deleteUser(id: string) {
    return api.delete(`/platform/users/${id}`).then((r) => r.data)
  },
  resetUserPassword(id: string) {
    return api
      .post<{ message: string; temporaryToken?: string }>(`/platform/users/${id}/reset-password`)
      .then((r) => r.data)
  },
  settings() {
    return api.get('/platform/settings').then((r) => r.data)
  },
  updateSettings(body: unknown) {
    return api.patch('/platform/settings', body).then((r) => r.data)
  },
}
