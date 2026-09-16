import { api } from './client'

export interface StaffRoleRef {
  id: string
  name: string
  isSystem: boolean
  branchId: string | null
  permissions: string[]
  assignmentId?: string
}

export interface StaffRecord {
  id: string
  branchId: string
  departmentId: string | null
  jobTitle: string | null
  employeeCode: string | null
  isActive: boolean
  joinedAt: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  branch: { id: string; name: string }
  department: { id: string; name: string } | null
  roles: StaffRoleRef[]
  groups: { id: string; name: string }[]
}

export interface CreateStaffInput {
  email: string
  firstName: string
  lastName: string
  branchId: string
  departmentId?: string | null
  jobTitle?: string | null
  employeeCode?: string | null
  joinedAt?: string | null
  roleIds?: string[]
  groupIds?: string[]
}

export type UpdateStaffInput = Partial<
  Omit<CreateStaffInput, 'email' | 'roleIds' | 'groupIds'> & { isActive?: boolean }
>

export const staffApi = {
  list(query?: {
    branchId?: string
    departmentId?: string
    groupId?: string
    search?: string
  }) {
    return api.get<StaffRecord[]>('/staff', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<StaffRecord>(`/staff/${id}`).then((r) => r.data)
  },
  create(body: CreateStaffInput) {
    return api
      .post<{ staffRecord: StaffRecord; user: unknown; temporaryPassword?: string }>('/staff', body)
      .then((r) => r.data)
  },
  update(id: string, body: UpdateStaffInput) {
    return api.patch<StaffRecord>(`/staff/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/staff/${id}`).then(() => undefined)
  },
  assignRoles(id: string, roleIds: string[], branchId?: string | null) {
    return api.post(`/staff/${id}/roles`, { roleIds, branchId }).then((r) => r.data)
  },
  removeRole(staffId: string, assignmentId: string) {
    return api.delete(`/staff/${staffId}/roles/${assignmentId}`).then((r) => r.data)
  },
  resetPassword(id: string) {
    return api
      .post<{ message: string; temporaryToken?: string }>(`/staff/${id}/reset-password`)
      .then((r) => r.data)
  },
}
