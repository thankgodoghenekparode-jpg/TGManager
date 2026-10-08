import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNumber: z.string().trim().max(50).optional().describe('Auto-generated if omitted'),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  dateOfBirth: z.string().datetime().optional().nullable(),
  passportPhoto: z.string().optional().nullable(),
  nationality: z.string().trim().max(100).default('Nigerian'),
  stateOfOrigin: z.string().trim().max(100).optional().nullable(),
  localGovernment: z.string().trim().max(100).optional().nullable(),
  religion: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  admissionDate: z.string().datetime().optional().nullable(),
  previousSchool: z.string().trim().max(200).optional().nullable(),
  currentClassId: z.string().cuid().optional().nullable(),
  branchId: z.string().cuid().optional().nullable(),
  armSection: z.string().trim().max(50).optional().nullable(),
  house: z.string().trim().max(50).optional().nullable(),
  bloodGroup: z.string().trim().max(10).optional().nullable(),
  genotype: z.string().trim().max(10).optional().nullable(),
  medicalNotes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED', 'WITHDRAWN']).default('ACTIVE'),
  guardian: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: z.string().trim().min(5),
    email: z.string().trim().email().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    relationship: z.string().trim().default('Parent'),
    isPrimary: z.boolean().default(true),
    emergencyContact: z.boolean().default(true),
  }).optional().nullable(),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial();
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;

export const queryStudentsSchema = z.object({
  search: z.string().trim().optional(),
  classId: z.string().cuid().optional(),
  branchId: z.string().cuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED', 'WITHDRAWN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type QueryStudentsDto = z.infer<typeof queryStudentsSchema>;

export const createGuardianSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z.string().trim().min(5, 'Phone number is required').max(50),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  occupation: z.string().trim().max(100).optional().nullable(),
});

export type CreateGuardianDto = z.infer<typeof createGuardianSchema>;

export const linkGuardianSchema = z.object({
  guardianId: z.string().cuid('Guardian ID is required'),
  relationship: z.string().trim().default('Parent'),
  isPrimary: z.boolean().default(false),
  emergencyContact: z.boolean().default(false),
  receivesNotifications: z.boolean().default(true),
});

export type LinkGuardianDto = z.infer<typeof linkGuardianSchema>;
