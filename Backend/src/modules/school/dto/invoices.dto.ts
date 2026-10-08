import { z } from 'zod';

export const createFeeStructureSchema = z.object({
  name: z.string().trim().min(2, 'Fee title is required (e.g. Tuition, Development Levy)').max(100),
  category: z.string().trim().min(1, 'Category is required (e.g. TUITION, BOARDING, UNIFORM, BOOKS)').max(50),
  amount: z.number().positive('Amount must be positive'),
  sessionId: z.string().cuid().optional().nullable(),
  termId: z.string().cuid().optional().nullable(),
  classId: z.string().cuid().optional().nullable(),
});

export type CreateFeeStructureDto = z.infer<typeof createFeeStructureSchema>;

export const invoiceItemInputSchema = z.object({
  feeStructureId: z.string().cuid().optional().nullable(),
  description: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
});

export const createStudentInvoiceSchema = z.object({
  studentId: z.string().cuid('Student ID is required'),
  sessionId: z.string().cuid().optional().nullable(),
  termId: z.string().cuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  discountAmount: z.number().min(0).default(0),
  items: z.array(invoiceItemInputSchema).min(1, 'At least one invoice item is required'),
});

export type CreateStudentInvoiceDto = z.infer<typeof createStudentInvoiceSchema>;

export const generateClassInvoicesSchema = z.object({
  classId: z.string().cuid('Class ID is required'),
  sessionId: z.string().cuid('Session ID is required'),
  termId: z.string().cuid('Term ID is required'),
  feeStructureIds: z.array(z.string().cuid()).min(1, 'Select at least one fee structure'),
  dueDate: z.string().datetime().optional().nullable(),
});

export type GenerateClassInvoicesDto = z.infer<typeof generateClassInvoicesSchema>;

export const recordSchoolPaymentSchema = z.object({
  invoiceId: z.string().cuid('Invoice ID is required'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'POS', 'ONLINE', 'OTHER']).default('CASH'),
  notes: z.string().trim().max(255).optional().nullable(),
  paymentDate: z.string().datetime().optional().nullable(),
});

export type RecordSchoolPaymentDto = z.infer<typeof recordSchoolPaymentSchema>;

export const queryInvoicesSchema = z.object({
  studentId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  sessionId: z.string().cuid().optional(),
  termId: z.string().cuid().optional(),
  status: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type QueryInvoicesDto = z.infer<typeof queryInvoicesSchema>;
