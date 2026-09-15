import { z } from 'zod';

export const documentTypeSchema = z
  .enum(['GENERAL', 'INVENTORY'])
  .describe('Document type');

export const documentGrantPermissionSchema = z
  .enum(['READ', 'WRITE'])
  .describe('Document grant permission level');

export const createDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(300)
    .describe('Document title'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch the document belongs to'),
  type: documentTypeSchema
    .optional()
    .describe('Document type (default GENERAL)'),
  metadata: z
    .string()
    .optional()
    .nullable()
    .describe('Optional metadata as a JSON string'),
});

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(300)
    .optional()
    .describe('Document title'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch the document belongs to'),
  type: documentTypeSchema.optional().describe('Document type'),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional metadata key/value object'),
});

export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

export const listDocumentsSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  type: documentTypeSchema.optional().describe('Filter by document type'),
});

export type ListDocumentsDto = z.infer<typeof listDocumentsSchema>;

export const grantDocumentSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, 'userId is required')
    .describe('User ID to grant access to'),
  permission: documentGrantPermissionSchema.describe(
    'Permission level (READ or WRITE)',
  ),
});

export type GrantDocumentDto = z.infer<typeof grantDocumentSchema>;
