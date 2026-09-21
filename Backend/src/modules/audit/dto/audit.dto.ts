import { z } from 'zod';

export const listAuditSchema = z.object({
  entityType: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Filter by audited entity type'),
  action: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Filter by action performed'),
  userId: z.string().trim().min(1).optional().describe('Filter by user ID'),
  from: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Start timestamp (ISO 8601)'),
  to: z.string().trim().min(1).optional().describe('End timestamp (ISO 8601)'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Maximum number of records to return (1-200)'),
  cursor: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Opaque cursor for the next page of results'),
});

export type ListAuditDto = z.infer<typeof listAuditSchema>;
