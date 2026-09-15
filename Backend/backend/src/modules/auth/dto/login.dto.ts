import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe('Account email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128)
    .describe('Account password (max 128 characters)'),
});

export type LoginDto = z.infer<typeof loginSchema>;
