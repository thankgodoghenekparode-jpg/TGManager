import { api, type Paginated } from './client'

export type AccountRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export interface RequestUserRef {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface EmailChangeRequest {
  id: string
  currentEmail: string
  requestedEmail: string
  reason: string | null
  status: AccountRequestStatus
  createdAt: string
  reviewedAt: string | null
  adminNote: string | null
  user: RequestUserRef
}

export interface PasswordResetRequest {
  id: string
  email: string
  status: AccountRequestStatus
  createdAt: string
  reviewedAt: string | null
  adminNote: string | null
  user: RequestUserRef
}

export interface RequestSummary {
  pendingEmailChanges: number
  pendingPasswordResets: number
  totalPending: number
}

export const accountRequestsApi = {
  summary() {
    return api.get<RequestSummary>('/admin/account-requests/summary').then((r) => r.data)
  },
  emailChanges(query?: { status?: AccountRequestStatus; limit?: number; offset?: number }) {
    return api
      .get<Paginated<EmailChangeRequest>>('/admin/account-requests/email-change', { params: query })
      .then((r) => r.data)
  },
  getEmailChange(id: string) {
    return api.get<EmailChangeRequest>(`/admin/account-requests/email-change/${id}`).then((r) => r.data)
  },
  approveEmailChange(id: string) {
    return api.post<{ ok: boolean; message: string }>(`/admin/account-requests/email-change/${id}/approve`).then((r) => r.data)
  },
  rejectEmailChange(id: string, adminNote?: string) {
    return api
      .post<{ ok: boolean; message: string }>(`/admin/account-requests/email-change/${id}/reject`, { adminNote })
      .then((r) => r.data)
  },
  passwordResets(query?: { status?: AccountRequestStatus; limit?: number; offset?: number }) {
    return api
      .get<Paginated<PasswordResetRequest>>('/admin/account-requests/password-reset', { params: query })
      .then((r) => r.data)
  },
  getPasswordReset(id: string) {
    return api.get<PasswordResetRequest>(`/admin/account-requests/password-reset/${id}`).then((r) => r.data)
  },
  approvePasswordReset(id: string) {
    return api
      .post<{ ok: boolean; message: string; temporaryPassword?: string }>(`/admin/account-requests/password-reset/${id}/approve`)
      .then((r) => r.data)
  },
  rejectPasswordReset(id: string, adminNote?: string) {
    return api
      .post<{ ok: boolean; message: string }>(`/admin/account-requests/password-reset/${id}/reject`, { adminNote })
      .then((r) => r.data)
  },
}
