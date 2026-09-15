import { z } from 'zod';

export const createDepartmentSchema = z.object({
  branchId: z
    .string()
    .trim()
    .min(1, 'Branch is required')
    .describe('ID of the branch the department belongs to'),
  name: z
    .string()
    .trim()
    .min(2, 'Department name is required')
    .max(200)
    .describe('Department name'),
  managerUserId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional user ID of the department manager'),
});

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
