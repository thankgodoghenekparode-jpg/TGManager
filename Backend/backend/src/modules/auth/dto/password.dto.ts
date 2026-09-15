import { z } from 'zod';

const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .describe('New password (min 8, max 128 characters)');

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required')
    .describe('Current account password'),
  newPassword: newPasswordSchema,
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe('Account email address'),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Reset token is required')
    .describe('Password reset token from the reset email'),
  newPassword: newPasswordSchema,
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
