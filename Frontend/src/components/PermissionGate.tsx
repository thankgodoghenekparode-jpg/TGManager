import type { ReactNode } from 'react'
import { isPlatformAdmin } from '../store/tenant'
import { useAuthStore } from '../store/auth'
import { useTenantStore } from '../store/tenant'

/** Pure check: true when role/tenancy grants at least one of the required permissions. */
export function hasPermission(opts: {
  role?: string
  isCompanyAdmin?: boolean
  tenantPermissions?: string[]
  required: readonly string[]
}): boolean {
  const { role, isCompanyAdmin, tenantPermissions = [], required } = opts
  if (isPlatformAdmin(role)) return true
  if (isCompanyAdmin) return true
  if (required.length === 0) return true
  return required.some((p) => tenantPermissions.includes(p))
}

/** True when the current user holds at least one of the given permissions. */
export function useCan(...permissions: string[]): boolean {
  const role = useAuthStore((s) => s.user?.role)
  const tenantPermissions = useTenantStore((s) => s.current?.permissions) ?? []
  const isCompanyAdmin = useTenantStore((s) => s.current?.isCompanyAdmin) ?? false
  return hasPermission({ role, isCompanyAdmin, tenantPermissions, required: permissions })
}

/** Conditionally renders children when the user has the required permission(s). */
export function Can({
  permissions = [],
  fallback = null,
  children,
}: {
  permissions?: string[]
  fallback?: ReactNode
  children: ReactNode
}) {
  const allowed = useCan(...permissions)
  return <>{allowed ? children : fallback}</>
}
