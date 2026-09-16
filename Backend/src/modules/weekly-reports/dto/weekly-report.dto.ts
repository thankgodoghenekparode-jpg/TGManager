import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must use YYYY-MM-DD format',
  })
  .describe('Report week start date in YYYY-MM-DD format');

const attachmentIdsSchema = z
  .array(z.string().trim().min(1))
  .max(10)
  .optional()
  .describe('IDs of uploaded documents to attach to the report');

export const submitWeeklyReportSchema = z.object({
  weekStart: dateString,
  notes: z
    .string()
    .trim()
    .max(10000)
    .optional()
    .nullable()
    .describe('Free-form notes for the report (max 10000 characters)'),
  attachmentIds: attachmentIdsSchema,
});

export type SubmitWeeklyReportDto = z.infer<typeof submitWeeklyReportSchema>;

export const updateWeeklyReportSchema = submitWeeklyReportSchema.partial();

export type UpdateWeeklyReportDto = z.infer<typeof updateWeeklyReportSchema>;

export const reviewWeeklyReportSchema = z.object({
  status: z.enum(['SUBMITTED', 'REVIEWED']).describe('New report status'),
});

export type ReviewWeeklyReportDto = z.infer<typeof reviewWeeklyReportSchema>;
