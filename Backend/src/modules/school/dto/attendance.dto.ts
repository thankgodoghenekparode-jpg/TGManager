import { z } from 'zod';

export const attendanceRecordItemSchema = z.object({
  studentId: z.string().cuid('Student ID is required'),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'CHECKED_OUT', 'EXCUSED']).default('PRESENT'),
  checkInTime: z.string().datetime().optional().nullable(),
  checkOutTime: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const markSchoolAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  classId: z.string().cuid().optional().nullable(),
  gateId: z.string().cuid().optional().nullable(),
  method: z.enum(['ID_CARD', 'PARENT_PORTAL', 'ADMIN', 'FUTURE_BIOMETRIC', 'FUTURE_NFC']).default('ADMIN'),
  records: z.array(attendanceRecordItemSchema).min(1, 'At least one attendance record is required'),
});

export type MarkSchoolAttendanceDto = z.infer<typeof markSchoolAttendanceSchema>;

export const scanAttendanceSchema = z
  .object({
    identifier: z.string().trim().optional(),
    scanPayload: z.string().trim().optional(),
    gateId: z.string().trim().optional().nullable(),
    branchId: z.string().trim().optional().nullable(),
    method: z.enum(['ID_CARD', 'PARENT_PORTAL', 'ADMIN', 'FUTURE_BIOMETRIC', 'FUTURE_NFC']).default('ID_CARD'),
    deviceId: z.string().trim().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
  })
  .transform((data) => ({
    ...data,
    identifier: (data.identifier || data.scanPayload || '').trim(),
  }))
  .refine((data) => Boolean(data.identifier), {
    message: 'Identifier (QR payload, card number, or student ID) is required',
    path: ['identifier'],
  });

export type ScanAttendanceDto = z.infer<typeof scanAttendanceSchema>;

export const querySchoolAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'CHECKED_OUT', 'EXCUSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type QuerySchoolAttendanceDto = z.infer<typeof querySchoolAttendanceSchema>;
