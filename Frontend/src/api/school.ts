import { api } from './client';

// ==================== Interfaces ====================

export interface SchoolProfile {
  id: string;
  tenantId: string;
  motto?: string | null;
  principalName?: string | null;
  schoolType: string;
  ownershipType: string;
  currency: string;
  openingTime: string;
  lateThreshold: string;
  geofenceRadius: number;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface AcademicSession {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate?: string | null;
  endDate?: string | null;
  terms?: Term[];
}

export interface Term {
  id: string;
  sessionId: string;
  name: string;
  isCurrent: boolean;
  status: string;
  resultEntryOpen: boolean;
  resultPublished: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ClassRoom {
  id: string;
  name: string;
  level: string;
  section?: string | null;
  capacity: number;
  classTeacherId?: string | null;
  classTeacher?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null;
  _count?: {
    students: number;
  };
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  category?: string | null;
  description?: string | null;
}

export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
  occupation?: string | null;
  address?: string | null;
}

export interface Student {
  id: string;
  admissionNumber: string;
  qrIdentifier: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender: string;
  dateOfBirth?: string | null;
  passportPhoto?: string | null;
  currentClassId?: string | null;
  currentClass?: ClassRoom | null;
  bloodGroup?: string | null;
  genotype?: string | null;
  phone?: string | null;
  address?: string | null;
  status: string;
  guardians?: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    emergencyContact: boolean;
    guardian: Guardian;
  }>;
  idCards?: Array<{
    id: string;
    cardNumber: string;
    qrPayload: string;
    expiresAt?: string | null;
    status: string;
  }>;
}

export interface SchoolAttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  method: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  gate?: { id: string; name: string; code: string } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    currentClass?: {
      name: string;
    } | null;
  };
}

export interface AttendanceStats {
  date: string;
  totalActiveStudents: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  halfDay: number;
  attendanceRatePercent: number;
}

export interface GradingScale {
  id: string;
  name: string;
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
  gradePoint?: number | null;
}

export interface AssessmentComponent {
  id: string;
  name: string;
  weightPercent: number;
  maxScore: number;
}

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface TimetablePeriod {
  id: string;
  classId: string;
  subjectId: string;
  teacherId?: string | null;
  room?: string | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  class: { id: string; name: string; level: string };
  subject: { id: string; name: string; code: string };
  teacher?: { id: string; firstName: string; lastName: string; photo?: string | null } | null;
}

export const SCHOOL_STAFF_CATEGORIES = [
  'TEACHER',
  'ADMINISTRATOR',
  'ACCOUNTANT',
  'SECRETARY',
  'GATE_OFFICER',
  'DRIVER',
  'SECURITY',
  'CLEANER',
  'OTHER',
] as const;
export type SchoolStaffCategory = (typeof SCHOOL_STAFF_CATEGORIES)[number];

export interface SchoolStaffMember {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  department?: string | null;
  designation?: string | null;
  category: SchoolStaffCategory;
  employmentDate?: string | null;
  photo?: string | null;
  status: string;
}

export interface AcademicResult {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade?: string | null;
  gradePoint?: number | null;
  remark?: string | null;
  status: string;
  subject: Subject;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
}

export interface ReportCard {
  school?: SchoolProfile | null;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    fullName: string;
    gender?: string;
    photo?: string | null;
    className: string;
  };
  session: string;
  term: string;
  class: { id: string; name: string; level: string } | null;
  results: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    assignmentScore?: number | null;
    testScore?: number | null;
    caScore: number;
    examScore: number;
    totalScore: number;
    grade?: string | null;
    gradePoint?: number | null;
    remark?: string | null;
    subjectPosition?: number | null;
    classAverage?: number | null;
    highestScore?: number | null;
    lowestScore?: number | null;
    status: string;
  }>;
  summary: {
    totalSubjects: number;
    totalMarks: number;
    obtainedMarks: number;
    averageScore: number;
    percentage: number;
    gpa: number;
    position: number | null;
    totalInClass: number;
    principalRemark: string;
    teacherRemark: string;
  };
}

export interface ClassResultsSheet {
  class: { id: string; name: string; level: string };
  session: string;
  term: string;
  subjectCount: number;
  totalStudents: number;
  students: Array<{
    studentId: string;
    admissionNumber: string;
    name: string;
    subjectsCount: number;
    obtained: number;
    possible: number;
    average: number;
    status: 'DRAFT' | 'APPROVED' | 'PUBLISHED';
    position: number;
  }>;
}

export interface FeeStructure {
  id: string;
  name: string;
  category: string;
  amount: number;
  sessionId?: string | null;
  termId?: string | null;
  classId?: string | null;
}

export interface StudentInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  dueDate?: string | null;
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    currentClass?: {
      name: string;
    } | null;
  };
  items: Array<{
    id: string;
    description: string;
    amount: number;
  }>;
  payments?: Array<{
    id: string;
    receiptNumber: string;
    amount: number;
    paymentDate: string;
    method: string;
    notes?: string | null;
  }>;
  _count?: { payments: number };
}

export interface SchoolPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'OTHER';
  paymentReference?: string | null;
  paymentDate: string;
  notes?: string | null;
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    currentClass?: { id: string; name: string } | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    balance: number;
    status: string;
  } | null;
  recordedBy?: { id: string; firstName: string; lastName: string } | null;
}

export const STAFF_ATTENDANCE_STATUSES = [
  'ON_TIME',
  'LATE',
  'EARLY_LEAVE',
  'OVERTIME',
  'MISSED_CLOCK_IN',
  'NO_CLOCK_OUT',
  'ABSENT',
] as const;
export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

export interface StaffAttendanceRecord {
  id: string;
  tenantId: string;
  schoolStaffId: string;
  date: string;
  clockInAt?: string | null;
  clockInLat?: number | null;
  clockInLng?: number | null;
  clockOutAt?: string | null;
  clockOutLat?: number | null;
  clockOutLng?: number | null;
  status: StaffAttendanceStatus;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  overtimeMinutes?: number | null;
  method: string;
  note?: string | null;
  schoolStaff: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    category: string;
    designation?: string | null;
    department?: string | null;
    photo?: string | null;
    userId?: string | null;
  };
  recordedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface StaffAttendanceSummary {
  total: number;
  present: number;
  byStatus: Partial<Record<StaffAttendanceStatus, number>>;
}

export interface RevenueStats {
  totalInvoicesCount: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRatePercent: number;
}

export type AnnouncementAudience = 'ALL' | 'STUDENTS' | 'PARENTS' | 'STAFF';

export interface SchoolAnnouncement {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  publishedAt: string;
  createdByUserId?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface SchoolAnalyticsOverview {
  students: {
    total: number;
    active: number;
    byStatus: Array<{ status: string; count: number }>;
    byGender: Array<{ gender: string; count: number }>;
  };
  staff: {
    total: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  academics: {
    classes: number;
    subjects: number;
    guardians: number;
    enrollmentByClass: Array<{ id: string; name: string; level: string; students: number }>;
  };
  attendanceToday: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  fees: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  results: { approved: number; published: number };
  currentSession?: {
    id: string;
    name: string;
    isCurrent: boolean;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  currentTerm?: {
    id: string;
    name: string;
    status: string;
    isCurrent: boolean;
    resultPublished: boolean;
    resultEntryOpen: boolean;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  announcements: number;
}

// ==================== API Client Methods ====================

export const schoolApi = {
  // Profile
  getProfile: () => api.get<SchoolProfile>('/school/profile').then((r) => r.data),
  updateProfile: (data: Partial<SchoolProfile>) =>
    api.put<SchoolProfile>('/school/profile', data).then((r) => r.data),

  // Sessions & Terms
  listSessions: () => api.get<AcademicSession[]>('/school/sessions').then((r) => r.data),
  createSession: (data: { name: string; startDate?: string; endDate?: string; isCurrent?: boolean }) =>
    api.post<AcademicSession>('/school/sessions', data).then((r) => r.data),
  listTerms: (sessionId?: string) =>
    api.get<Term[]>('/school/terms', { params: { sessionId } }).then((r) => r.data),
  createTerm: (data: { sessionId: string; name: string; startDate?: string; endDate?: string; isCurrent?: boolean }) =>
    api.post<Term>('/school/terms', data).then((r) => r.data),

  // Classes & Subjects
  listClasses: (sessionId?: string) =>
    api.get<ClassRoom[]>('/school/classes', { params: { sessionId } }).then((r) => r.data),
  createClass: (data: { name: string; level: string; section?: string; capacity?: number; classTeacherId?: string; sessionId?: string }) =>
    api.post<ClassRoom>('/school/classes', data).then((r) => r.data),
  updateClass: (id: string, data: Partial<ClassRoom>) =>
    api.patch<ClassRoom>(`/school/classes/${id}`, data).then((r) => r.data),
  listSubjects: () => api.get<Subject[]>('/school/subjects').then((r) => r.data),
  createSubject: (data: { name: string; code: string; category?: string; description?: string }) =>
    api.post<Subject>('/school/subjects', data).then((r) => r.data),
  assignClassSubject: (data: { classId: string; subjectId: string; teacherId?: string }) =>
    api
      .post(`/school/classes/${data.classId}/subjects`, {
        subjectId: data.subjectId,
        teacherId: data.teacherId,
      })
      .then((r) => r.data),

  // School Staff & Teachers
  listSchoolStaff: (params?: { search?: string; category?: string; status?: string }) =>
    api.get<SchoolStaffMember[]>('/school/staff', { params }).then((r) => r.data),
  createSchoolStaff: (data: Partial<SchoolStaffMember>) =>
    api.post<SchoolStaffMember>('/school/staff', data).then((r) => r.data),
  updateSchoolStaff: (id: string, data: Partial<SchoolStaffMember>) =>
    api.patch<SchoolStaffMember>(`/school/staff/${id}`, data).then((r) => r.data),
  deleteSchoolStaff: (id: string) =>
    api.delete(`/school/staff/${id}`).then((r) => r.data),

  // Timetable
  listTimetable: (params?: { classId?: string; teacherId?: string; subjectId?: string; dayOfWeek?: DayOfWeek }) =>
    api.get<TimetablePeriod[]>('/school/timetable', { params }).then((r) => r.data),
  createTimetablePeriod: (data: {
    classId: string;
    subjectId: string;
    teacherId?: string | null;
    room?: string | null;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  }) => api.post<TimetablePeriod>('/school/timetable', data).then((r) => r.data),
  updateTimetablePeriod: (id: string, data: Partial<Omit<TimetablePeriod, 'id' | 'class' | 'subject' | 'teacher'>>) =>
    api.patch<TimetablePeriod>(`/school/timetable/${id}`, data).then((r) => r.data),
  deleteTimetablePeriod: (id: string) =>
    api.delete(`/school/timetable/${id}`).then((r) => r.data),

  // Students & Guardians
  listStudents: (params?: { classId?: string; search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ items: Student[]; total: number; page: number; limit: number }>('/school/students', { params }).then((r) => r.data),
  getStudent: (id: string) => api.get<Student>(`/school/students/${id}`).then((r) => r.data),
  createStudent: (data: Partial<Student>) =>
    api
      .post<
        Student & {
          studentAccount?: { email: string; password: string | null; created: boolean }
        }
      >('/school/students', data)
      .then((r) => r.data),
  updateStudent: (id: string, data: Partial<Student>) => api.patch<Student>(`/school/students/${id}`, data).then((r) => r.data),
  deleteStudent: (id: string) => api.delete(`/school/students/${id}`).then((r) => r.data),
  issueIdCard: (studentId: string) => api.post(`/school/students/${studentId}/id-card`).then((r) => r.data),
  listGuardians: (search?: string) => api.get<Guardian[]>('/school/guardians', { params: { search } }).then((r) => r.data),
  createGuardian: (data: Partial<Guardian>) => api.post<Guardian>('/school/guardians', data).then((r) => r.data),
  linkGuardian: (studentId: string, data: { guardianId: string; relationship?: string; isPrimary?: boolean; emergencyContact?: boolean }) =>
    api.post(`/school/students/${studentId}/guardians`, data).then((r) => r.data),

  // Attendance
  getAttendance: (params: { date?: string; classId?: string; status?: string; page?: number; limit?: number }) =>
    api.get<{ items: SchoolAttendanceRecord[]; total: number; page?: number; limit?: number; totalPages?: number }>('/school/attendance', { params }).then((r) => {
      if (Array.isArray(r.data)) return r.data;
      if (r.data && Array.isArray((r.data as any).items)) return (r.data as any).items as SchoolAttendanceRecord[];
      return [] as SchoolAttendanceRecord[];
    }),
  getAttendancePaged: (params: { date?: string; classId?: string; status?: string; page?: number; limit?: number }) =>
    api
      .get<{ items: SchoolAttendanceRecord[]; total: number; page: number; limit: number; totalPages: number }>(
        '/school/attendance',
        { params },
      )
      .then((r) => r.data),
  getAttendanceStats: (date?: string) =>
    api.get<AttendanceStats>('/school/attendance/stats', { params: { date } }).then((r) => r.data),
  markAttendanceBulk: (data: { date: string; classId?: string; records: Array<{ studentId: string; status: string; notes?: string }>; latitude?: number | null; longitude?: number | null }) =>
    api.post('/school/attendance/mark', data).then((r) => r.data),
  scanAttendance: (data: { scanPayload?: string; identifier?: string; gateId?: string; direction?: 'IN' | 'OUT'; latitude?: number | null; longitude?: number | null }) =>
    api.post('/school/attendance/scan', data).then((r) => r.data),

  // Grading & Assessment
  listGradingScales: () => api.get<GradingScale[]>('/school/grading/scales').then((r) => r.data),
  createGradingScale: (data: Partial<GradingScale>) =>
    api.post<GradingScale>('/school/grading/scales', data).then((r) => r.data),
  listComponents: () => api.get<AssessmentComponent[]>('/school/grading/components').then((r) => r.data),
  createComponent: (data: Partial<AssessmentComponent>) =>
    api.post<AssessmentComponent>('/school/grading/components', data).then((r) => r.data),
  queryResults: (params: { sessionId?: string; termId?: string; classId?: string; subjectId?: string; studentId?: string }) =>
    api.get<AcademicResult[]>('/school/grading/results', { params }).then((r) => r.data),
  recordResults: (data: {
    sessionId: string;
    termId: string;
    classId: string;
    subjectId: string;
    scores: Array<{
      studentId: string;
      assignmentScore?: number | null;
      testScore?: number | null;
      caScore?: number;
      examScore?: number;
      remark?: string | null;
    }>;
  }) => api.post('/school/grading/results', data).then((r) => r.data),
  approveResults: (data: { sessionId: string; termId: string; classId: string; subjectId?: string; action: 'APPROVE' | 'REJECT' | 'PUBLISH'; notes?: string | null }) =>
    api.post('/school/grading/approve', data).then((r) => r.data),
  getReportCard: (studentId: string, sessionId: string, termId: string) =>
    api.get<ReportCard>(`/school/grading/report-card/${studentId}`, { params: { sessionId, termId } }).then((r) => r.data),
  getClassResultsSheet: (params: { classId: string; sessionId: string; termId: string }) =>
    api.get<ClassResultsSheet>('/school/grading/class-sheet', { params }).then((r) => r.data),

  // Fees & Invoices
  listFeeStructures: (params?: { classId?: string; sessionId?: string; termId?: string }) =>
    api.get<FeeStructure[]>('/school/fees/structures', { params }).then((r) => r.data),
  createFeeStructure: (data: Partial<FeeStructure>) =>
    api.post<FeeStructure>('/school/fees/structures', data).then((r) => r.data),
  updateFeeStructure: (id: string, data: Partial<FeeStructure>) =>
    api.patch<FeeStructure>(`/school/fees/structures/${id}`, data).then((r) => r.data),
  deleteFeeStructure: (id: string) =>
    api.delete(`/school/fees/structures/${id}`).then((r) => r.data),
  listInvoices: (params?: { sessionId?: string; termId?: string; classId?: string; status?: string; search?: string }) =>
    api.get<{ items: StudentInvoice[]; total: number }>('/school/invoices', { params }).then((r) => r.data),
  getInvoice: (id: string) => api.get<StudentInvoice>(`/school/invoices/${id}`).then((r) => r.data),
  createInvoice: (data: { studentId: string; sessionId?: string; termId?: string; dueDate?: string; items: Array<{ description: string; amount: number; feeStructureId?: string }> }) =>
    api.post<StudentInvoice>('/school/invoices', data).then((r) => r.data),
  generateClassInvoices: (data: { classId: string; sessionId: string; termId: string; dueDate?: string; feeStructureIds: string[] }) =>
    api.post('/school/invoices/generate-class', data).then((r) => r.data),
  recordPayment: (data: { invoiceId: string; amount: number; method: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE' | 'OTHER'; notes?: string; paymentDate?: string }) =>
    api.post('/school/payments', data).then((r) => r.data),
  listPayments: (params?: { invoiceId?: string; studentId?: string; method?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) =>
    api
      .get<{ items: SchoolPayment[]; total: number; page: number; limit: number; totalPages: number; totalAmountPaid: number }>(
        '/school/payments',
        { params },
      )
      .then((r) => r.data),
  getRevenueStats: (params?: { sessionId?: string; termId?: string }) =>
    api.get<RevenueStats>('/school/fees/stats', { params }).then((r) => r.data),

  // Staff Attendance (clock in/out)
  listStaffAttendance: (params?: {
    schoolStaffId?: string;
    status?: StaffAttendanceStatus;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<{ items: StaffAttendanceRecord[]; total: number; page: number; limit: number; totalPages: number }>(
        '/school/staff-attendance',
        { params },
      )
      .then((r) => r.data),
  getStaffAttendanceSummary: (params?: { from?: string; to?: string; schoolStaffId?: string }) =>
    api
      .get<StaffAttendanceSummary>('/school/staff-attendance/summary', { params })
      .then((r) => r.data),
  getMyStaffAttendanceToday: () =>
    api
      .get<{
        staff: StaffAttendanceRecord['schoolStaff'] | null;
        record: StaffAttendanceRecord | null;
        date?: string;
      }>('/school/staff-attendance/today')
      .then((r) => r.data),
  clockStaffIn: (data: { schoolStaffId?: string | null; latitude?: number | null; longitude?: number | null; note?: string | null }) =>
    api.post<StaffAttendanceRecord>('/school/staff-attendance/clock-in', data).then((r) => r.data),
  clockStaffOut: (data: { schoolStaffId?: string | null; latitude?: number | null; longitude?: number | null; note?: string | null }) =>
    api.post<StaffAttendanceRecord>('/school/staff-attendance/clock-out', data).then((r) => r.data),
  recordStaffAttendance: (data: {
    schoolStaffId: string;
    date: string;
    clockInAt?: string | null;
    clockOutAt?: string | null;
    status?: StaffAttendanceStatus;
    note?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }) => api.post<StaffAttendanceRecord>('/school/staff-attendance/record', data).then((r) => r.data),
  deleteStaffAttendance: (id: string) =>
    api.delete(`/school/staff-attendance/${id}`).then((r) => r.data),

  // Announcements
  listAnnouncements: (params?: { audience?: AnnouncementAudience; search?: string; page?: number; limit?: number }) =>
    api.get<{ items: SchoolAnnouncement[]; total: number; page: number; limit: number }>('/school/announcements', { params }).then((r) => r.data),
  createAnnouncement: (data: { title: string; content: string; audience: AnnouncementAudience; publishedAt?: string | null }) =>
    api.post<SchoolAnnouncement>('/school/announcements', data).then((r) => r.data),
  updateAnnouncement: (id: string, data: Partial<{ title: string; content: string; audience: AnnouncementAudience; publishedAt?: string | null }>) =>
    api.patch<SchoolAnnouncement>(`/school/announcements/${id}`, data).then((r) => r.data),
  deleteAnnouncement: (id: string) => api.delete(`/school/announcements/${id}`).then((r) => r.data),

  // Analytics
  getSchoolAnalyticsOverview: () =>
    api.get<SchoolAnalyticsOverview>('/school/analytics/overview').then((r) => r.data),
};
