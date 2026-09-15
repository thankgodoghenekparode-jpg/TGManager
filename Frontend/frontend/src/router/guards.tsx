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
  const tenantId = useTenantStore((s) => s.current?.id)
  const loading = useTenantStore((s) => s.loading)

  if (!user) return <Navigate to="/login" replace />
  if (loading) return null
  if (!tenantId) return <Navigate to="/select-company" replace />
  return <>{children ?? <Outlet />}</>
}

/** Redirects authenticated users away from guest-only pages. */
export function GuestGuard({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  if (!initialized) return null
  if (user) return <Navigate to="/" replace />
  return <>{children ?? <Outlet />}</>
}
