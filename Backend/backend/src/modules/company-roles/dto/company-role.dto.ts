import { z } from 'zod';
import {
  ALL_PERMISSIONS,
  Permission,
} from '../../rbac/permissions/permissions.constants';

export const createCompanyRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Role name is required')
    .max(100)
    .describe('Role name'),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .describe('Role description (max 500 characters)'),
  permissions: z
    .array(z.string().trim().min(1))
    .max(200)
    .optional()
    .default([])
    .describe('Permission keys granted to the role'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch-scoped role'),
});

export type CreateCompanyRoleDto = z.infer<typeof createCompanyRoleSchema>;

export const updateCompanyRoleSchema = createCompanyRoleSchema
  .omit({ branchId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateCompanyRoleDto = z.infer<typeof updateCompanyRoleSchema>;

export const assignRoleSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, 'User is required')
    .describe('User ID to assign the role to'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch scope for the assignment'),
});

export type AssignRoleDto = z.infer<typeof assignRoleSchema>;

export type { Permission };

export { ALL_PERMISSIONS };
