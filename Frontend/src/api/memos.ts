import { api } from './client'

export interface MemoAudience {
  all?: boolean
  branchIds?: string[]
  groupIds?: string[]
  userIds?: string[]
  departmentIds?: string[]
}

export interface Memo {
  id: string
  tenantId: string
  branchId: string | null
  createdByUserId: string
  title: string
  body: string
  through?: string | null
  audience: MemoAudience
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  read?: boolean
  createdBy?: { id: string; firstName: string; lastName: string; email: string }
  createdByUser?: { id: string; firstName: string; lastName: string; email: string }
  branch?: { id: string; name: string }
  reads?: Array<{ id: string; userId: string; readAt: string; user: { id: string; firstName: string; lastName: string } }>
}

export interface CreateMemoInput {
  title: string
  body: string
  through?: string | null
  branchId?: string | null
  audience?: MemoAudience
  publish?: boolean
}

export type UpdateMemoInput = Partial<Omit<CreateMemoInput, 'publish'>>

export const memosApi = {
  list(query?: { branchId?: string }) {
    return api.get<Memo[]>('/memos', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<Memo>(`/memos/${id}`).then((r) => r.data)
  },
  create(body: CreateMemoInput) {
    return api.post<Memo>('/memos', body).then((r) => r.data)
  },
  update(id: string, body: UpdateMemoInput) {
    return api.patch<Memo>(`/memos/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/memos/${id}`).then(() => undefined)
  },
  markRead(id: string) {
    return api.post(`/memos/${id}/read`).then((r) => r.data)
  },
  publish(id: string) {
    return api.post(`/memos/${id}/publish`).then((r) => r.data)
  },
}