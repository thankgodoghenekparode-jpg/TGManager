import { api } from './client'

export interface AttendanceReport {
  summary: {
    totalRecords: number
    byStatus: Record<string, number>
    totalWorkHours: number
    presentDays: number
    absentDays: number
  }
  records: Array<{
    id: string
    date: string
    status: string
    clockInAt: string | null
    clockOutAt: string | null
    branchId: string | null
    branchName: string | null
    staffName: string | null
    jobTitle: string | null
  }>
}

export interface StaffReport {
  summary: {
    totalStaff: number
    active: number
    inactive: number
    byBranch: Record<string, number>
    byDepartment: Record<string, number>
  }
  records: Array<{
    id: string
    name: string
    email: string
    branchName: string | null
    department: string | null
    jobTitle: string | null
    employeeCode: string | null
    isActive: boolean
    joinedAt: string | null
  }>
}

export interface InventoryReport {
  summary: {
    totalItems: number
    lowStockItems: number
    byBranch: Record<string, number>
  }
  items: Array<{
    id: string
    sku: string | null
    name: string
    branchName: string | null
    quantity: number
    unit: string | null
    minQuantity: number
    location: string | null
    isLowStock: boolean
  }>
}

export const reportsApi = {
  attendance(query?: { from?: string; to?: string; branchId?: string; staffRecordId?: string }) {
    return api.get<AttendanceReport>('/reports/attendance', { params: query }).then((r) => r.data)
  },
  staff(query?: { branchId?: string; departmentId?: string }) {
    return api.get<StaffReport>('/reports/staff', { params: query }).then((r) => r.data)
  },
  inventory(query?: { branchId?: string; lowStock?: boolean }) {
    return api.get<InventoryReport>('/reports/inventory', { params: query }).then((r) => r.data)
  },
}

export type ReportKind = 'attendance' | 'staff' | 'inventory'

const exportRoute: Record<ReportKind, string> = {
  attendance: '/reports/attendance/export',
  staff: '/reports/staff/export',
  inventory: '/reports/inventory/export',
}

/**
 * Download a report CSV through the authenticated API client so tenant and
 * bearer headers are sent (a plain <a href> cannot attach headers).
 */
export async function downloadReportCsv(
  kind: ReportKind,
  query?: Record<string, unknown>,
): Promise<void> {
  const res = await api.get(exportRoute[kind], { params: query, responseType: 'blob' })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}