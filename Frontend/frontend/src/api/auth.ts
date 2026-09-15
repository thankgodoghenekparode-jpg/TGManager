import { api, type AuthUser, type TenantMembership } from './client'

export interface LoginResponse {
  user: AuthUser
}

export interface MeResponse {
  user: AuthUser
  memberships: TenantMembership[]
}

interface SessionResponse {
  user: AuthUser | null
}

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return api.post('/auth/login', { email, password }).then((r) => r.data)
  },
  me(): Promise<MeResponse> {
    return api.get('/auth/me').then((r) => r.data)
  },
  logout(): Promise<void> {
    return api.post('/auth/logout').then(() => undefined)
  },
  refresh(): Promise<SessionResponse> {
    return api.post('/auth/refresh').then((r) => r.data)
  },
  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return api.patch('/auth/change-password', { currentPassword, newPassword }).then(() => undefined)
  },
  forgotPassword(email: string): Promise<{ message: string }> {
    return api.post('/auth/forgot-password', { email }).then((r) => r.data)
  },
  passwordResetRequest(email: string): Promise<{ message: string }> {
    return api.post('/auth/password-reset-request', { email }).then((r) => r.data)
  },
  resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    return api.post('/auth/reset-password', { token, newPassword }).then((r) => r.data)
  },
}
