import { z } from 'zod';

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in 24-hour HH:MM format');

export const createTimetablePeriodSchema = z
  .object({
    classId: z.string().cuid('Class ID is required'),
    subjectId: z.string().cuid('Subject ID is required'),
    teacherId: z.string().cuid().optional().nullable(),
    room: z.string().trim().max(100).optional().nullable(),
    dayOfWeek: z.enum(DAYS_OF_WEEK),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export type CreateTimetablePeriodDto = z.infer<
  typeof createTimetablePeriodSchema
>;

export const updateTimetablePeriodSchema = z
  .object({
    classId: z.string().cuid().optional(),
    subjectId: z.string().cuid().optional(),
    teacherId: z.string().cuid().optional().nullable(),
    room: z.string().trim().max(100).optional().nullable(),
    dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .refine(
    (data) =>
      data.startTime !== undefined && data.endTime !== undefined
        ? data.startTime < data.endTime
        : true,
    { message: 'End time must be after start time', path: ['endTime'] },
  );

export type UpdateTimetablePeriodDto = z.infer<
  typeof updateTimetablePeriodSchema
>;

export const queryTimetableSchema = z.object({
  classId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  subjectId: z.string().cuid().optional(),
  dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
});

export type QueryTimetableDto = z.infer<typeof queryTimetableSchema>;
