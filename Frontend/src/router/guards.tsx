import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useTenantStore, isPlatformAdmin } from '../store/tenant'
import { hasPermission } from '../components/PermissionGate'

/** Requires an authenticated user. Renders children (or <Outlet/>) once bootstrapped. */
export function AuthGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()

  if (!initialized || loading) {
    return null
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children ?? <Outlet />}</>
}

/** Requires the current user to be a platform administrator. */
export function PlatformGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user || !isPlatformAdmin(user.role)) {
    return <Navigate to="/login" replace />
  }
  return <>{children ?? <Outlet />}</>
}

/** Requires an authenticated company user with an active tenant context. */
export function CompanyGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.current)
  const loading = useTenantStore((s) => s.loading)
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace />
  // Platform administrators use the /admin console only — never a tenant workspace.
  if (isPlatformAdmin(user.role)) return <Navigate to="/admin" replace />
  if (loading) return null
  if (!tenant?.id) return <Navigate to="/select-company" replace />
  if (tenant.type === 'SCHOOL') {
    if (location.pathname.startsWith('/app/staff')) return <Navigate to="/school/staff" replace />
    if (location.pathname.startsWith('/app/chat')) return <Navigate to="/school/chat" replace />
    if (location.pathname.startsWith('/app/memos')) return <Navigate to="/school/memos" replace />
    return <Navigate to="/school" replace />
  }
  return <>{children ?? <Outlet />}</>
}

/** True when the active tenant grants parent-portal access. */
export function hasParentAccess(tenant: { permissions?: string[] } | null | undefined): boolean {
  return Boolean(tenant?.permissions?.includes('school.parent_view'))
}

/** True when the signed-in user holds any management permission in the school. */
function isSchoolStaff(tenant: { permissions?: string[] } | null | undefined): boolean {
  const permissions = tenant?.permissions ?? []
  return [
    'school.manage',
    'student.manage',
    'academic.manage',
    'school_fee.manage',
    'school_attendance.manage',
  ].some((p) => permissions.includes(p))
}

/** Requires an authenticated school user with an active school tenant context. */
export function SchoolGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.current)
  const loading = useTenantStore((s) => s.loading)

  if (!user) return <Navigate to="/login" replace />
  // Platform administrators use the /admin console only — never a tenant workspace.
  if (isPlatformAdmin(user.role)) return <Navigate to="/admin" replace />
  if (loading) return null
  if (!tenant?.id) return <Navigate to="/select-company" replace />
  if (tenant.type === 'COMPANY') return <Navigate to="/app" replace />
  // Pure guardians are routed to the parent portal instead of the staff console.
  if (hasParentAccess(tenant) && !isSchoolStaff(tenant)) {
    return <Navigate to="/parent" replace />
  }
  return <>{children ?? <Outlet />}</>
}

/** Requires the active tenant to grant parent-portal access (a linked guardian). */
export function ParentGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.current)
  const loading = useTenantStore((s) => s.loading)

  if (!user) return <Navigate to="/login" replace />
  // Platform administrators use the /admin console only — never a tenant workspace.
  if (isPlatformAdmin(user.role)) return <Navigate to="/admin" replace />
  if (loading) return null
  if (!tenant?.id) return <Navigate to="/select-company" replace />
  if (!hasParentAccess(tenant)) return <Navigate to="/school" replace />
  return <>{children ?? <Outlet />}</>
}

/**
 * `hasPermission` lives in the PermissionGate component module; re-exported
 * here for route guards. A route renders its element only when the signed-in
 * user holds at least one of the required permissions, otherwise it bounces
 * back to the workspace home (the sidebar already hides the link).
 */
export function RequirePermission({
  permissions,
  redirectTo = '/',
  children,
}: {
  permissions: readonly string[]
  redirectTo?: string
  children: ReactNode
}) {
  const role = useAuthStore((s) => s.user?.role)
  const tenant = useTenantStore((s) => s.current)
  const loading = useTenantStore((s) => s.loading)

  if (loading) return null
  const allowed = hasPermission({
    role,
    isCompanyAdmin: tenant?.isCompanyAdmin ?? false,
    tenantPermissions: tenant?.permissions ?? [],
    required: permissions,
  })
  if (!allowed) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}

/** Redirects authenticated users away from guest-only pages. */
export function GuestGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.current)
  const initialized = useAuthStore((s) => s.initialized)
  if (!initialized) return null
  if (user) {
    if (isPlatformAdmin(user.role)) {
      return <Navigate to="/admin" replace />
    }
    if (!tenant?.id) {
      return <Navigate to="/select-company" replace />
    }
    return <Navigate to={tenant.type === 'SCHOOL' ? '/school' : '/app'} replace />
  }
  return <>{children ?? <Outlet />}</>
}
