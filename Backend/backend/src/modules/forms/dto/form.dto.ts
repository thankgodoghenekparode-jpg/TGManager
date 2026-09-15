import { z } from 'zod';

export const formFieldTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'RADIO',
  'CHECKBOX',
]);

export const formFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Field key is required')
    .max(100)
    .describe('Unique field key'),
  label: z
    .string()
    .trim()
    .min(1, 'Field label is required')
    .max(200)
    .describe('Display label for the field'),
  type: formFieldTypeSchema.describe('Field type'),
  required: z
    .boolean()
    .default(false)
    .describe('Whether the field is required'),
  options: z
    .array(z.string().trim().min(1))
    .max(100)
    .optional()
    .describe('Selectable options (for SELECT/RADIO/CHECKBOX)'),
  order: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Display order within the form'),
  section: z
    .string()
    .trim()
    .max(200)
    .default('General')
    .describe('Named section the field belongs to'),
  roleKey: z
    .enum([
      'ACCOUNT_ASSIST',
      'SECRETARY',
      'IT_MANAGER',
      'ENERGY_MANAGER',
      'GENERAL_MANAGER',
      'MD',
    ])
    .optional()
    .nullable()
    .describe(
      'Optional role that owns this section. Null/general sections are editable by the secretary and other non-approver roles.',
    ),
});

export const createFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Form name is required')
    .max(200)
    .describe('Form name'),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Form description (max 2000 characters)'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch the form belongs to'),
  isCustomerTicket: z
    .boolean()
    .default(false)
    .describe('Whether this form is a Customer Ticket (parent) form'),
  parentFormId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe(
      'Optional ID of the Customer Ticket (parent) form this child form is linked to',
    ),
  fields: z
    .array(formFieldSchema)
    .min(1, 'At least one field is required')
    .describe('Form fields (at least one)'),
});

export type CreateFormDto = z.infer<typeof createFormSchema>;

export const updateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Form name is required')
    .max(200)
    .optional()
    .describe('Form name'),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Form description (max 2000 characters)'),
  isCustomerTicket: z
    .boolean()
    .optional()
    .describe('Whether this form is a Customer Ticket (parent) form'),
  parentFormId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe(
      'Optional ID of the Customer Ticket (parent) form this child form is linked to',
    ),
  fields: z
    .array(formFieldSchema)
    .min(1, 'At least one field is required')
    .optional()
    .describe('Form fields (at least one)'),
});

export type UpdateFormDto = z.infer<typeof updateFormSchema>;

export const submitFormSchema = z.object({
  data: z
    .record(z.string(), z.unknown())
    .describe('Submission payload keyed by form field keys'),
});

export type SubmitFormDto = z.infer<typeof submitFormSchema>;

export const listFormsSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  published: z
    .enum(['true', 'false'])
    .optional()
    .describe('Filter by published state'),
});

export type ListFormsDto = z.infer<typeof listFormsSchema>;
