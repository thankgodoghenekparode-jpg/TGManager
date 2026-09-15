import { api } from './client'

export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'OVERTIME'
  | 'MISSED_CLOCK_IN'
  | 'NO_CLOCK_OUT'
  | 'ABSENT'

export interface AttendanceRecord {
  id: string
  tenantId: string
  userId: string
  branchId: string
  staffRecordId: string | null
  date: string
  clockInAt: string | null
  clockOutAt: string | null
  clockInLat: number | null
  clockInLng: number | null
  clockOutLat: number | null
  clockOutLng: number | null
  lateMinutes: number | null
  earlyLeaveMinutes: number | null
  overtimeMinutes: number | null
  status: AttendanceStatus
  note: string | null
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
  user?: { id: string; email: string; firstName: string; lastName: string }
}

export interface AttendanceSummary {
  total: number
  present: number
  byStatus: Partial<Record<AttendanceStatus, number>>
}

export interface ListAttendanceQuery {
  branchId?: string
  staffRecordId?: string
  status?: AttendanceStatus
  from?: string
  to?: string
}

export const attendanceApi = {
  list(query?: ListAttendanceQuery) {
    return api.get<AttendanceRecord[]>('/attendance', { params: query }).then((r) => r.data)
  },
  summary(query?: Pick<ListAttendanceQuery, 'branchId' | 'staffRecordId' | 'from' | 'to'>) {
    return api.get<AttendanceSummary>('/attendance/summary', { params: query }).then((r) => r.data)
  },
  clockIn(body: { latitude: number; longitude: number; staffRecordId?: string; note?: string }) {
    return api.post<AttendanceRecord>('/attendance/clock-in', body).then((r) => r.data)
  },
  clockOut(body: { latitude: number; longitude: number; note?: string }) {
    return api.post<AttendanceRecord>('/attendance/clock-out', body).then((r) => r.data)
  },
  update(
    id: string,
    body: { clockInAt?: string; clockOutAt?: string; status?: AttendanceStatus; note?: string },
  ) {
    return api.patch<AttendanceRecord>(`/attendance/${id}`, body).then((r) => r.data)
  },
}