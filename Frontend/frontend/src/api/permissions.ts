import { api } from './client'

export interface PermissionCatalog {
  permissions: string[]
  grouped: Record<string, string[]>
  systemRoles: Array<{ name: string; description: string; permissions: string[] }>
}

export const permissionsApi = {
  catalog(): Promise<PermissionCatalog> {
    return api.get('/permissions').then((r) => r.data)
  },
}
