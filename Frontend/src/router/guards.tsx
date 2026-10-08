import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useTenantStore, isPlatformAdmin } from '../store/tenant'

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

/** Requires an authenticated school user with an active school tenant context. */
export function SchoolGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const tenant = useTenantStore((s) => s.current)
  const loading = useTenantStore((s) => s.loading)

  if (!user) return <Navigate to="/login" replace />
  if (loading) return null
  if (!tenant?.id) return <Navigate to="/select-company" replace />
  if (tenant.type === 'COMPANY') return <Navigate to="/app" replace />
  return <>{children ?? <Outlet />}</>
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
