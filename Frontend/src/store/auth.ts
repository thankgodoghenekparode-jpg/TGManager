import { create } from 'zustand'
import { authApi } from '../api/auth'
import { setAccessToken } from '../api/client'
import type { AuthUser, TenantMembership } from '../api/client'

interface AuthState {
  user: AuthUser | null
  memberships: TenantMembership[]
  loading: boolean
  initialized: boolean
  setUser: (user: AuthUser | null) => void
  setMemberships: (memberships: TenantMembership[]) => void
  login: (email: string, password: string) => Promise<void>
  bootstrap: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  memberships: [],
  loading: false,
  initialized: false,

  setUser(user) {
    set({ user })
  },
  setMemberships(memberships) {
    set({ memberships })
  },

  async login(email, password) {
    set({ loading: true })
    try {
      const res = await authApi.login(email, password)
      setAccessToken(null)
      set({ user: res.user })
    } finally {
      set({ loading: false })
    }
  },

  async bootstrap() {
    set({ loading: true })
    try {
      const res = await authApi.me()
      set({ user: res.user, memberships: res.memberships, initialized: true })
    } catch {
      set({ user: null, memberships: [], initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  async logout() {
    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      set({ user: null, memberships: [] })
    }
  },
}))
