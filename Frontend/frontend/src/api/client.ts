import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

/** Value stored in localStorage for the active tenant context (companion to the x-tenant-id header). */
const TENANT_ID_KEY = 'zarox:tenantId'
const TENANT_ID_COOKIE = 'zarox_tenant'
const CSRF_COOKIE = 'zarox_csrf'
const CSRF_HEADER = 'x-csrf-token'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

let accessToken: string | null = null

// In-memory copy of the active tenant id so the x-tenant-id header keeps being
// sent even if localStorage is cleared or wiped by another tab logging out.
let cachedTenantId: string | null = null

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
}

/** Read the readable double-submit CSRF cookie set alongside auth cookies. */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/** Set once after login/refresh so that API calls that need a bearer fallback can use it. */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

/** Read the access token from the companion cookie (used by the realtime socket). */
export function getAccessTokenCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )zarox_access=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}

export function getTenantId(): string | null {
  if (cachedTenantId) return cachedTenantId
  let stored: string | null = null
  try {
    stored = localStorage.getItem(TENANT_ID_KEY)
  } catch {
    stored = null
  }
  const source = stored ?? readCookie(TENANT_ID_COOKIE)
  if (source) {
    cachedTenantId = source
    try {
      if (!stored) localStorage.setItem(TENANT_ID_KEY, source)
    } catch {
      // ignore storage errors (private browsing / storage disabled)
    }
  }
  return cachedTenantId
}

export function setTenantId(id: string | null): void {
  cachedTenantId = id
  if (typeof document === 'undefined') return
  if (id) {
    try {
      localStorage.setItem(TENANT_ID_KEY, id)
    } catch {
      // ignore storage errors; the in-memory cache still covers this session
    }
    writeCookie(TENANT_ID_COOKIE, id, 60 * 60 * 24 * 365)
  } else {
    try {
      localStorage.removeItem(TENANT_ID_KEY)
    } catch {
      // ignore storage errors
    }
    writeCookie(TENANT_ID_COOKIE, '', 0)
  }
}

// Attach the active tenant id to every request (unless it is a tenant-agnostic route).
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let tenantId = getTenantId()

  // Fallback: a request may fire (e.g. a page that mounts before tenant context is
  // fully loaded) before getTenantId() has populated its cache. The in-memory zustand
  // store, once resolved, holds the authoritative current tenant id. Load lazily to
  // avoid a module-import cycle (store/tenant.ts imports this module).
  if (!tenantId) {
    try {
      const { useTenantStore } = await import('../store/tenant')
      tenantId = useTenantStore.getState().current?.id ?? null
      if (tenantId) {
        cachedTenantId = tenantId
      }
    } catch {
      tenantId = null
    }
  }

  if (tenantId) config.headers.set('x-tenant-id', tenantId)
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  if (MUTATING_METHODS.has((config.method ?? 'get').toUpperCase())) {
    const csrfToken = getCsrfToken()
    if (csrfToken) config.headers.set(CSRF_HEADER, csrfToken)
  }
  return config
})

// Retry once on 401 to refresh cookies, then let the caller handle failure.
let refreshPromise: Promise<void> | null = null

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ user: AuthUser | null }>('/auth/refresh')
      .then((res) => {
        setAccessToken(null)
        return res.data.user ?? null
      })
      .then((user) => {
        // treat a null user as an expired session
        if (!user) throw new AxiosError('Session expired', 'session')
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined
    const status = error.response?.status
    const url = original?.url ?? ''

    // Never retry auth-related endpoints in this loop (guards against recursion).
    const isAuthUrl =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    if (status === 401 && original && !original._retry && !isAuthUrl) {
      original._retry = true
      try {
        await refreshSession()
        return api(original)
      } catch {
        setAccessToken(null)
        // The session is unrecoverable (refresh failed) — drop the cached user
        // so the route guards bounce the user to /login for a fresh cookie set.
        try {
          const { useAuthStore } = await import('../store/auth')
          useAuthStore.getState().setUser(null)
        } catch {
          // ignore
        }
        throw error
      }
    }
    throw error
  },
)

/** Extract a human-friendly error message from an axios error response. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined
    if (data?.message) {
      return Array.isArray(data.message) ? data.message[0] : data.message
    }
    return error.message
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}

/* ---------------------------------- types ---------------------------------- */

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'PLATFORM_SUPPORT' | 'COMPANY_ADMIN' | 'BRANCH_ADMIN' | 'USER'
  avatarUrl: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TenantMembership {
  id: string
  name: string
  slug: string
  status: string
  onboardingStatus: string
  plan: { code: string; name: string } | null
}

export interface StaffRole {
  id: string
  name: string
  isSystem: boolean
  branchId: string | null
}

export interface CurrentTenant {
  id: string
  name: string
  slug: string
  status: string
  onboardingStatus: string
  timezone: string
  plan: {
    code: string
    name: string
    maxBranches: number | null
    maxStaff: number | null
  }
  permissions: string[]
  isCompanyAdmin: boolean
  roles: Array<StaffRole & { permissions: string[] }>
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
