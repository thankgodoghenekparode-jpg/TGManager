import { api } from './client'

export interface CompanyRole {
  id: string
  tenantId: string
  branchId: string | null
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
  _count?: { assignments: number }
}

export interface CreateRoleInput {
  name: string
  description?: string | null
  permissions?: string[]
  branchId?: string | null
}

export type UpdateRoleInput = Partial<Omit<CreateRoleInput, 'branchId'>>

export const rolesApi = {
  list() {
    return api.get<CompanyRole[]>('/company-roles').then((r) => r.data)
  },
  get(id: string) {
    return api
      .get<CompanyRole & { assignments: Array<{ id: string; userId: string; branchId: string | null; user: { id: string; email: string; firstName: string; lastName: string } }> }>(
        `/company-roles/${id}`,
      )
      .then((r) => r.data)
  },
  create(body: CreateRoleInput) {
    return api.post<CompanyRole>('/company-roles', body).then((r) => r.data)
  },
  update(id: string, body: UpdateRoleInput) {
    return api.patch<CompanyRole>(`/company-roles/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/company-roles/${id}`).then(() => undefined)
  },
  assign(roleId: string, userId: string, branchId?: string | null) {
    return api.post(`/company-roles/${roleId}/assign`, { userId, branchId }).then((r) => r.data)
  },
  unassign(roleId: string, assignmentId: string) {
    return api.delete(`/company-roles/${roleId}/assignments/${assignmentId}`).then((r) => r.data)
  },
}
