import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  branchId: z
    .string()
    .trim()
    .min(1, 'Branch is required')
    .describe('ID of the branch the item belongs to'),
  sku: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .describe('Stock keeping unit code'),
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200)
    .describe('Item name'),
  quantity: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Current quantity on hand (default 0)'),
  unit: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .describe('Unit of measure (e.g. pcs, kg)'),
  minQuantity: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Reorder threshold for low-stock alerts'),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .describe('Storage location within the branch'),
});

export type CreateInventoryItemDto = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .describe('Stock keeping unit code'),
  name: z
    .string()
    .trim()
    .min(1, 'Item name is required')
    .max(200)
    .optional()
    .describe('Item name'),
  unit: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable()
    .describe('Unit of measure (e.g. pcs, kg)'),
  minQuantity: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Reorder threshold for low-stock alerts'),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .describe('Storage location within the branch'),
});

export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>;

export const adjustInventorySchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta must be non-zero')
    .describe('Quantity change (positive to add, negative to remove)'),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500)
    .describe('Reason for the adjustment (max 500 characters)'),
});

export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;

export const listInventorySchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .describe('Filter to low-stock items only'),
});

export type ListInventoryDto = z.infer<typeof listInventorySchema>;
