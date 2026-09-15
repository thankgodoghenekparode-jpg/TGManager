import { z } from 'zod';

export const scheduleScopeSchema = z
  .enum(['BRANCH', 'DEPARTMENT', 'STAFF'])
  .describe('Schedule scope');

export const workingDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .describe('Working days as day-of-week indices (0=Sunday .. 6=Saturday)');

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format')
  .describe('Time in HH:MM (24h) format');

const scheduleFields = {
  scope: scheduleScopeSchema,
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Branch ID (required for BRANCH scope)'),
  departmentId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Department ID (required for DEPARTMENT scope)'),
  staffRecordId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Staff record ID (required for STAFF scope)'),
  resumptionTime: timeSchema.describe('Daily resumption time'),
  closingTime: timeSchema.describe(
    'Daily closing time (later than resumption)',
  ),
  latePeriodMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .describe('Grace period in minutes before clock-in is late'),
  workingDays: workingDaysSchema.optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('IANA timezone for the schedule'),
};

export const createScheduleSchema = z
  .object(scheduleFields)
  .refine(
    (d) =>
      !d.resumptionTime || !d.closingTime || d.closingTime > d.resumptionTime,
    {
      message: 'closingTime must be later than resumptionTime',
      path: ['closingTime'],
    },
  );

export type CreateScheduleDto = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = z
  .object(scheduleFields)
  .partial()
  .refine(
    (d) =>
      !d.resumptionTime || !d.closingTime || d.closingTime > d.resumptionTime,
    {
      message: 'closingTime must be later than resumptionTime',
      path: ['closingTime'],
    },
  );
export type UpdateScheduleDto = z.infer<typeof updateScheduleSchema>;

export const listSchedulesSchema = z.object(scheduleFields).partial();

export type ListSchedulesDto = z.infer<typeof listSchedulesSchema>;
