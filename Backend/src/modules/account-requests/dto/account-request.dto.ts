import { z } from 'zod';
import { AccountRequestStatus } from '../../../generated/prisma/enums';

export const createEmailChangeSchema = z.object({
  requestedEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe('The new email address the customer wants to switch to'),
  reason: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .describe('Optional reason for the request'),
});

export type CreateEmailChangeDto = z.infer<typeof createEmailChangeSchema>;

export const createPasswordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe('The registered email of the account'),
});

export type CreatePasswordResetRequestDto = z.infer<
  typeof createPasswordResetRequestSchema
>;

export const rejectRequestSchema = z.object({
  adminNote: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .describe('Reason for rejecting the request'),
});

export type RejectRequestDto = z.infer<typeof rejectRequestSchema>;

const requestStatusSchema = z
  .enum([
    AccountRequestStatus.PENDING,
    AccountRequestStatus.APPROVED,
    AccountRequestStatus.REJECTED,
    AccountRequestStatus.COMPLETED,
  ])
  .optional()
  .describe('Filter requests by status');

export const listRequestsSchema = z.object({
  status: requestStatusSchema.describe('Filter by status'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum requests to return (1-200, default 50)'),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Pagination offset (default 0)'),
});

export type ListRequestsDto = z.infer<typeof listRequestsSchema>;
