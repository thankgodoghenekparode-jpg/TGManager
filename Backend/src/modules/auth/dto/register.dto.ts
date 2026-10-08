import { z } from 'zod';

export const registerSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(200, 'Organization name must be under 200 characters'),
  type: z.enum(['COMPANY', 'SCHOOL']).default('COMPANY'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email address is required')
    .max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be under 100 characters'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
