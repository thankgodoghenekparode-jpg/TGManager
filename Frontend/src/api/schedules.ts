import { api } from './client'

export type ScheduleScope = 'BRANCH' | 'DEPARTMENT' | 'STAFF'

export interface Schedule {
  id: string
  tenantId: string
  scope: ScheduleScope
  branchId: string | null
  departmentId: string | null
  staffRecordId: string | null
  resumptionTime: string
  closingTime: string
  latePeriodMinutes: number
  workingDays: number[]
  timezone: string
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
  department?: { id: string; name: string }
  staffRecord?: {
    id: string
    user: { id: string; email: string; firstName: string; lastName: string }
  }
}

export interface CreateScheduleInput {
  scope: ScheduleScope
  branchId?: string | null
  departmentId?: string | null
  staffRecordId?: string | null
  resumptionTime: string
  closingTime: string
  latePeriodMinutes?: number
  workingDays?: number[]
  timezone?: string
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>

export const schedulesApi = {
  list(query?: Partial<CreateScheduleInput>) {
    return api.get<Schedule[]>('/schedules', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<Schedule>(`/schedules/${id}`).then((r) => r.data)
  },
  create(body: CreateScheduleInput) {
    return api.post<Schedule>('/schedules', body).then((r) => r.data)
  },
  update(id: string, body: UpdateScheduleInput) {
    return api.patch<Schedule>(`/schedules/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/schedules/${id}`).then(() => undefined)
  },
}