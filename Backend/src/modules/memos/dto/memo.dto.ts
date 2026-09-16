import { z } from 'zod';

export const memoAudienceSchema = z.object({
  all: z.boolean().optional().describe('Send to all staff'),
  branchIds: z
    .array(z.string().trim().min(1))
    .max(100)
    .optional()
    .describe('Branch IDs to target'),
  groupIds: z
    .array(z.string().trim().min(1))
    .max(100)
    .optional()
    .describe('Group IDs to target'),
  userIds: z
    .array(z.string().trim().min(1))
    .max(200)
    .optional()
    .describe('Specific user IDs to target'),
  departmentIds: z
    .array(z.string().trim().min(1))
    .max(100)
    .optional()
    .describe('Department IDs to target all active staff in those departments'),
});

export const createMemoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200)
    .describe('Memo title'),
  body: z
    .string()
    .trim()
    .min(1, 'Body is required')
    .max(10000)
    .describe('Memo body (max 10000 characters)'),
  through: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .describe(
      'Who the memo passes through (e.g. a manager), shown on the THROUGH line',
    ),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch scope'),
  audience: memoAudienceSchema.optional().describe('Target audience'),
  publish: z
    .boolean()
    .optional()
    .describe('Publish immediately instead of saving as draft'),
});

export type CreateMemoDto = z.infer<typeof createMemoSchema>;

export const updateMemoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200)
    .optional()
    .describe('Memo title'),
  body: z
    .string()
    .trim()
    .min(1, 'Body is required')
    .max(10000)
    .optional()
    .describe('Memo body (max 10000 characters)'),
  through: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .describe(
      'Who the memo passes through (e.g. a manager), shown on the THROUGH line',
    ),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch scope'),
  audience: memoAudienceSchema.optional().describe('Target audience'),
});

export type UpdateMemoDto = z.infer<typeof updateMemoSchema>;

export const listMemosSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
});

export type ListMemosDto = z.infer<typeof listMemosSchema>;
