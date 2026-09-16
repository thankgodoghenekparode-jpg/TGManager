import { api } from './client'

export interface Department {
  id: string
  tenantId: string
  branchId: string
  name: string
  managerUserId: string | null
  createdAt: string
  updatedAt: string
}

export const departmentsApi = {
  list(query?: { branchId?: string }) {
    return api.get<Department[]>('/departments', { params: query }).then((r) => r.data)
  },
  create(body: { branchId: string; name: string; managerUserId?: string | null }) {
    return api.post<Department>('/departments', body).then((r) => r.data)
  },
  update(id: string, body: { name?: string; managerUserId?: string | null }) {
    return api.patch<Department>(`/departments/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/departments/${id}`).then(() => undefined)
  },
}
