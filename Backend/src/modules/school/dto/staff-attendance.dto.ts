import { z } from 'zod';

const ATTENDANCE_STATUSES = [
  'ON_TIME',
  'LATE',
  'EARLY_LEAVE',
  'OVERTIME',
  'MISSED_CLOCK_IN',
  'NO_CLOCK_OUT',
  'ABSENT',
] as const;

/**
 * Clock in / out for a school staff member. Admins/managers may pass
 * `schoolStaffId` to clock a colleague in or out; otherwise the record is
 * created for the authenticated staff member.
 */
export const clockSchoolStaffInSchema = z.object({
  schoolStaffId: z.string().cuid().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
});

export type ClockSchoolStaffInDto = z.infer<typeof clockSchoolStaffInSchema>;

export const clockSchoolStaffOutSchema = z.object({
  schoolStaffId: z.string().cuid().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
});

export type ClockSchoolStaffOutDto = z.infer<typeof clockSchoolStaffOutSchema>;

export const querySchoolStaffAttendanceSchema = z.object({
  schoolStaffId: z.string().cuid().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export type QuerySchoolStaffAttendanceDto = z.infer<
  typeof querySchoolStaffAttendanceSchema
>;

/**
 * Manual attendance entry for a staff member (e.g. correcting a missed
 * clock-in). Restricted to admins/managers.
 */
export const recordSchoolStaffAttendanceSchema = z.object({
  schoolStaffId: z.string().cuid('Staff member is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  clockInAt: z.string().datetime().optional().nullable(),
  clockOutAt: z.string().datetime().optional().nullable(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  note: z.string().trim().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type RecordSchoolStaffAttendanceDto = z.infer<
  typeof recordSchoolStaffAttendanceSchema
>;
