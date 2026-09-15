import { api } from './client'

export type AccountRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type AccountRequestType = 'EMAIL_CHANGE' | 'PASSWORD_RESET'

export interface MyAccountRequest {
  id: string
  type: AccountRequestType
  status: AccountRequestStatus
  createdAt: string
  description: string
  adminNote: string | null
}

export const accountApi = {
  createEmailChange(body: { requestedEmail: string; reason?: string }) {
    return api
      .post<{ request: { id: string }; message: string }>('/account/email-change-request', body)
      .then((r) => r.data)
  },
  myRequests() {
    return api
      .get<{ items: MyAccountRequest[] }>('/account/requests')
      .then((r) => r.data)
  },
}
