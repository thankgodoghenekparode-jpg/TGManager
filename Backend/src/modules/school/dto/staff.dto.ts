import { z } from 'zod';

export const STAFF_CATEGORIES = [
  'TEACHER',
  'ADMINISTRATOR',
  'ACCOUNTANT',
  'SECRETARY',
  'GATE_OFFICER',
  'DRIVER',
  'SECURITY',
  'CLEANER',
  'OTHER',
] as const;

export const createSchoolStaffSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  employeeNumber: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  designation: z.string().trim().max(150).optional().nullable(),
  category: z.enum(STAFF_CATEGORIES).default('TEACHER'),
  employmentDate: z.string().datetime().optional().nullable(),
  photo: z.string().trim().max(500).optional().nullable(),
  status: z.string().trim().max(50).default('ACTIVE'),
});

export type CreateSchoolStaffDto = z.infer<typeof createSchoolStaffSchema>;

export const updateSchoolStaffSchema = createSchoolStaffSchema.partial();
export type UpdateSchoolStaffDto = z.infer<typeof updateSchoolStaffSchema>;

export const querySchoolStaffSchema = z.object({
  search: z.string().trim().optional(),
  category: z.enum(STAFF_CATEGORIES).optional(),
  status: z.string().trim().optional(),
});

export type QuerySchoolStaffDto = z.infer<typeof querySchoolStaffSchema>;
