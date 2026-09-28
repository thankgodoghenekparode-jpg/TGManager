import { api, type CurrentTenant, type TenantMembership } from './client'

export const tenantsApi = {
  my(): Promise<TenantMembership[]> {
    return api.get('/tenants').then((r) => r.data)
  },
  current(): Promise<CurrentTenant> {
    return api.get('/tenants/current').then((r) => r.data)
  },
  uploadLogo(file: File): Promise<{ logoKey: string }> {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/tenants/current/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  removeLogo(): Promise<void> {
    return api.delete('/tenants/current/logo').then(() => undefined)
  },
}