import { create } from 'zustand'
import { tenantsApi } from '../api/tenants'
import { getTenantId, setTenantId } from '../api/client'
import type { CurrentTenant } from '../api/client'

interface TenantState {
  current: CurrentTenant | null
  loading: boolean
  error: string | null
  load: () => Promise<void>
  clear: () => void
}

export const useTenantStore = create<TenantState>((set) => ({
  current: null,
  loading: false,
  error: null,

  async load() {
    // Only load when a tenant is selected.
    const tenantId = getTenantId()
    if (!tenantId) {
      set({ current: null, error: null, loading: false })
      return
    }
    set({ loading: true, error: null })
    try {
      const current = await tenantsApi.current()
      // Re-sync the header source so a cleared/wiped localStorage fallback
      // doesn't leave subsequent requests without the x-tenant-id header.
      setTenantId(current.id)
      set({ current, loading: false })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load tenant', loading: false })
    }
  },

  clear() {
    setTenantId(null)
    set({ current: null, error: null })
  },
}))

/** True when the current user is a platform-level admin (super admin or support). */
export function isPlatformAdmin(role?: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPPORT'
}
