import { z } from 'zod';

export const createStaffSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe('Staff member email address'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100)
    .describe('Staff first name'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(100)
    .describe('Staff last name'),
  branchId: z
    .string()
    .trim()
    .min(1, 'Branch is required')
    .describe('Branch the staff member belongs to'),
  departmentId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional department ID'),
  jobTitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .describe('Job title (max 200 characters)'),
  employeeCode: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .describe('Employee code (max 100 characters)'),
  joinedAt: z.coerce
    .date()
    .optional()
    .nullable()
    .describe('Join date (ISO 8601)'),
  roleIds: z
    .array(z.string().trim().min(1))
    .max(50)
    .optional()
    .describe('Company role IDs to assign'),
  groupIds: z
    .array(z.string().trim().min(1))
    .max(500)
    .optional()
    .describe('Group IDs to add the staff member to'),
});

export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Staff first name'),
    lastName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe('Staff last name'),
    branchId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Branch the staff member belongs to'),
    departmentId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .nullable()
      .describe('Optional department ID'),
    jobTitle: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .describe('Job title (max 200 characters)'),
    employeeCode: z
      .string()
      .trim()
      .max(100)
      .optional()
      .nullable()
      .describe('Employee code (max 100 characters)'),
    joinedAt: z.coerce
      .date()
      .optional()
      .nullable()
      .describe('Join date (ISO 8601)'),
    isActive: z
      .boolean()
      .optional()
      .describe('Whether the staff member is active'),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

export const assignRolesSchema = z.object({
  roleIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(50)
    .describe('Company role IDs to assign (1-50)'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch scope for the assignments'),
});

export type AssignRolesDto = z.infer<typeof assignRolesSchema>;
