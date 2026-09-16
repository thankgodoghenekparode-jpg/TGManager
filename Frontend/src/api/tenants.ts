import { api, type CurrentTenant, type TenantMembership } from './client'

export const tenantsApi = {
  my(): Promise<TenantMembership[]> {
    return api.get('/tenants').then((r) => r.data)
  },
  current(): Promise<CurrentTenant> {
    return api.get('/tenants/current').then((r) => r.data)
  },
}
