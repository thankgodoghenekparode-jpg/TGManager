import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date must use YYYY-MM-DD format',
  })
  .describe('Date in YYYY-MM-DD format');

export const reportRangeSchema = z.object({
  from: dateString.optional().describe('Start date (inclusive)'),
  to: dateString.optional().describe('End date (inclusive)'),
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
});

export const attendanceReportSchema = reportRangeSchema.extend({
  staffRecordId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Filter by staff record ID'),
});

export type AttendanceReportDto = z.infer<typeof attendanceReportSchema>;

export const staffReportSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  departmentId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Filter by department ID'),
});

export type StaffReportDto = z.infer<typeof staffReportSchema>;

export const inventoryReportSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .describe('Filter to low-stock items only'),
});

export type InventoryReportDto = z.infer<typeof inventoryReportSchema>;
