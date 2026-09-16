import { api } from './client'

export interface Branch {
  id: string
  tenantId: string
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters: number | null
  phoneNumber: string | null
  openingTime: string | null
  closingTime: string | null
  workingDays: number[]
  timezone: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface CreateBranchInput {
  name: string
  address: string
  latitude: number
  longitude: number
  radiusMeters?: number | null
  phoneNumber?: string | null
  openingTime?: string | null
  closingTime?: string | null
  workingDays?: number[]
  timezone?: string
}

export type UpdateBranchInput = Partial<CreateBranchInput> & { status?: Branch['status'] }

export const branchesApi = {
  list() {
    return api.get<Branch[]>('/branches').then((r) => r.data)
  },
  get(id: string) {
    return api.get<Branch & { _count: { departments: number; groups: number; staffRecords: number } }>(
      `/branches/${id}`,
    ).then((r) => r.data)
  },
  create(body: CreateBranchInput) {
    return api.post<Branch>('/branches', body).then((r) => r.data)
  },
  update(id: string, body: UpdateBranchInput) {
    return api.patch<Branch>(`/branches/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/branches/${id}`).then(() => undefined)
  },
}
