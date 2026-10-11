import { z } from 'zod';

export const inviteGuardianSchema = z.object({
  guardianId: z.string().cuid('Guardian ID is required'),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(100).optional(),
});

export type InviteGuardianDto = z.infer<typeof inviteGuardianSchema>;

export const childAttendanceQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export type ChildAttendanceQueryDto = z.infer<typeof childAttendanceQuerySchema>;

export const childResultsQuerySchema = z.object({
  sessionId: z.string().cuid().optional(),
  termId: z.string().cuid().optional(),
});

export type ChildResultsQueryDto = z.infer<typeof childResultsQuerySchema>;

export const childReportCardQuerySchema = z.object({
  sessionId: z.string().cuid('Session ID is required'),
  termId: z.string().cuid('Term ID is required'),
});

export type ChildReportCardQueryDto = z.infer<
  typeof childReportCardQuerySchema
>;
