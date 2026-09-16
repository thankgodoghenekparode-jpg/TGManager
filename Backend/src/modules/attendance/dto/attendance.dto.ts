import { z } from 'zod';

const latitudeSchema = z
  .number()
  .min(-90)
  .max(90)
  .describe('Latitude in decimal degrees (-90 to 90)');
const longitudeSchema = z
  .number()
  .min(-180)
  .max(180)
  .describe('Longitude in decimal degrees (-180 to 180)');

const dateFilterSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .describe('Date in YYYY-MM-DD format');

export const clockInSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  staffRecordId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Staff record ID (optional for auto-clock-in)'),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .describe('Optional clock-in note (max 1000 characters)'),
});

export type ClockInDto = z.infer<typeof clockInSchema>;

export const clockOutSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .describe('Optional clock-out note (max 1000 characters)'),
});

export type ClockOutDto = z.infer<typeof clockOutSchema>;

export const attendanceStatusSchema = z.enum([
  'ON_TIME',
  'LATE',
  'EARLY_LEAVE',
  'OVERTIME',
  'MISSED_CLOCK_IN',
  'NO_CLOCK_OUT',
  'ABSENT',
]);

export const updateAttendanceSchema = z.object({
  clockInAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .describe('Clock-in timestamp (ISO 8601)'),
  clockOutAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .describe('Clock-out timestamp (ISO 8601)'),
  status: attendanceStatusSchema.optional().describe('Attendance status'),
  note: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .describe('Attendance note (max 1000 characters)'),
});

export type UpdateAttendanceDto = z.infer<typeof updateAttendanceSchema>;

export const listAttendanceSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  staffRecordId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Filter by staff record ID'),
  status: attendanceStatusSchema
    .optional()
    .describe('Filter by attendance status'),
  from: dateFilterSchema.optional().describe('Start date (inclusive)'),
  to: dateFilterSchema.optional().describe('End date (inclusive)'),
});

export type ListAttendanceDto = z.infer<typeof listAttendanceSchema>;
