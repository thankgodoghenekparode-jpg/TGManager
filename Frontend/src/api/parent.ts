import { api } from './client';
import type { ReportCard, Student } from './school';

export interface ParentGuardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
}

export interface ParentChild extends Student {
  relationship: string;
  isPrimary: boolean;
}

export interface ParentProfile {
  guardian: ParentGuardian;
  children: ParentChild[];
}

export interface ChildAttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'CHECKED_OUT' | 'EXCUSED';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  method: string;
  notes?: string | null;
}

export interface ChildResult {
  id: string;
  subjectId: string;
  classId: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade?: string | null;
  gradePoint?: number | null;
  remark?: string | null;
  status: string;
  subject: { id: string; name: string; code: string };
  class: { id: string; name: string; level: string };
}

export interface ParentChildInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  dueDate?: string | null;
  items?: Array<{ id: string; description: string; amount: number }>;
  payments?: Array<{
    id: string;
    receiptNumber: string;
    amount: number;
    method: string;
    paymentDate: string;
  }>;
  session?: { id: string; name: string } | null;
  term?: { id: string; name: string } | null;
}

export interface InviteGuardianResult {
  guardianId: string;
  userId: string;
  email: string;
  accountCreated: boolean;
  temporaryPassword: string | null;
}

export const parentApi = {
  me: () => api.get<ParentProfile>('/school/parent/me').then((r) => r.data),
  children: () => api.get<ParentChild[]>('/school/parent/children').then((r) => r.data),
  child: (id: string) => api.get<ParentChild>(`/school/parent/children/${id}`).then((r) => r.data),
  attendance: (id: string, params?: { from?: string; to?: string }) =>
    api
      .get<ChildAttendanceRecord[]>(`/school/parent/children/${id}/attendance`, { params })
      .then((r) => r.data),
  results: (id: string, params?: { sessionId?: string; termId?: string }) =>
    api
      .get<ChildResult[]>(`/school/parent/children/${id}/results`, { params })
      .then((r) => r.data),
  reportCard: (id: string, sessionId: string, termId: string) =>
    api
      .get<ReportCard>(`/school/parent/children/${id}/report-card`, {
        params: { sessionId, termId },
      })
      .then((r) => r.data),
  invoices: (id: string) =>
    api.get<ParentChildInvoice[]>(`/school/parent/children/${id}/invoices`).then((r) => r.data),
  invite: (data: { guardianId: string; email?: string; password?: string }) =>
    api.post<InviteGuardianResult>('/school/parent/invite', data).then((r) => r.data),
};
