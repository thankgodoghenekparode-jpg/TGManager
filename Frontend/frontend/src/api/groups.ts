import { api } from './client'
import type { Branch } from './branches'

export interface StaffGroup {
  id: string
  tenantId: string
  branchId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count?: { staffGroups: number }
  branch?: Branch
  members?: Array<{
    id: string
    jobTitle: string | null
    user: { id: string; email: string; firstName: string; lastName: string }
  }>
}

export interface CreateGroupInput {
  branchId: string
  name: string
  description?: string | null
}

export type UpdateGroupInput = Partial<Omit<CreateGroupInput, 'branchId'>>

export const groupsApi = {
  list(query?: { branchId?: string }) {
    return api.get<StaffGroup[]>('/groups', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<StaffGroup>(`/groups/${id}`).then((r) => r.data)
  },
  create(body: CreateGroupInput) {
    return api.post<StaffGroup>('/groups', body).then((r) => r.data)
  },
  update(id: string, body: UpdateGroupInput) {
    return api.patch<StaffGroup>(`/groups/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/groups/${id}`).then(() => undefined)
  },
  addMembers(id: string, staffRecordIds: string[]) {
    return api.post<StaffGroup>(`/groups/${id}/members`, { staffRecordIds }).then((r) => r.data)
  },
  removeMember(id: string, staffRecordId: string) {
    return api.delete<StaffGroup>(`/groups/${id}/members/${staffRecordId}`).then((r) => r.data)
  },
}

export type StaffGroupMember = NonNullable<StaffGroup['members']>[number]