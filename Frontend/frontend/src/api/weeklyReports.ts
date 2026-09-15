import { api } from './client'

export type ReportStatus = 'SUBMITTED' | 'REVIEWED'

export interface ReportPerson {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
}

export interface ReportAttachment {
  id: string
  title: string
  mimeType: string | null
  sizeBytes: number | null
}

export interface WeeklyReport {
  id: string
  tenantId: string
  submittedByUserId: string
  weekStart: string
  weekEnd: string
  notes: string | null
  status: ReportStatus
  attachmentIds: string[]
  reviewedAt: string | null
  reviewedByUserId: string | null
  createdAt: string
  updatedAt: string
  submittedBy: ReportPerson | null
  reviewedBy: ReportPerson | null
  attachments: ReportAttachment[]
}

export interface SubmitWeeklyReport {
  weekStart: string
  notes?: string | null
  attachmentIds?: string[]
}

export const weeklyReportsApi = {
  myReports() {
    return api.get<WeeklyReport[]>('/weekly-reports').then((r) => r.data)
  },
  allReports() {
    return api.get<WeeklyReport[]>('/weekly-reports/all').then((r) => r.data)
  },
  get(id: string) {
    return api.get<WeeklyReport>(`/weekly-reports/${id}`).then((r) => r.data)
  },
  submit(body: SubmitWeeklyReport) {
    return api.post<WeeklyReport>('/weekly-reports', body).then((r) => r.data)
  },
  update(id: string, body: Partial<SubmitWeeklyReport>) {
    return api.patch<WeeklyReport>(`/weekly-reports/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/weekly-reports/${id}`).then(() => undefined)
  },
  setStatus(id: string, status: ReportStatus) {
    return api.patch<WeeklyReport>(`/weekly-reports/${id}/status`, { status }).then((r) => r.data)
  },
}