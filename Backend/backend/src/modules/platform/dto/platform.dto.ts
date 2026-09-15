import { z } from 'zod';
import { UserRole } from '../../../generated/prisma/enums';

export const planFeatureFlagsSchema = z
  .record(z.string(), z.union([z.boolean(), z.number(), z.string()]))
  .optional()
  .describe('Feature flags for the plan');

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(100).describe('Plan display name'),
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Code must be lowercase alphanumeric')
    .describe('Unique plan code (lowercase alphanumeric)'),
  priceCents: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Monthly price in cents (default 0)'),
  maxBranches: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Max branches (null = unlimited)'),
  maxStaff: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Max staff members (null = unlimited)'),
  maxDocuments: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Max documents (null = unlimited)'),
  maxStorageBytes: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Max storage in bytes (null = unlimited)'),
  maxChatMessages: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('Max chat messages (null = unlimited)'),
  featureFlags: planFeatureFlagsSchema,
  isActive: z.boolean().optional().describe('Whether the plan is active'),
});

export type CreatePlanDto = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof updatePlanSchema>;

export const createPlatformUserSchema = z.object({
  email: z.string().trim().email().describe('User email address'),
  firstName: z.string().trim().min(1).max(100).describe('User first name'),
  lastName: z.string().trim().min(1).max(100).describe('User last name'),
  role: z
    .enum([UserRole.SUPER_ADMIN, UserRole.PLATFORM_SUPPORT])
    .describe('Platform role'),
});

export type CreatePlatformUserDto = z.infer<typeof createPlatformUserSchema>;

const platformUserRoleSchema = z
  .enum([UserRole.SUPER_ADMIN, UserRole.PLATFORM_SUPPORT])
  .describe('Platform role');

export const updatePlatformUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('User first name'),
  lastName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('User last name'),
  role: platformUserRoleSchema.optional().describe('Platform role'),
  isActive: z.boolean().optional().describe('Whether the user is active'),
});

export type UpdatePlatformUserDto = z.infer<typeof updatePlatformUserSchema>;

export const listPlatformUsersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe('Search platform users by name/email'),
  role: platformUserRoleSchema.optional().describe('Filter by role'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum users to return (1-100, default 50)'),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Pagination offset (default 0)'),
});

export type ListPlatformUsersDto = z.infer<typeof listPlatformUsersSchema>;

const tenantStatusSchema = z
  .enum(['ACTIVE', 'SUSPENDED', 'TRIAL_ENDED'])
  .describe('Tenant status');
const tenantOnboardingSchema = z
  .enum([
    'PENDING_BRANCH',
    'BRANCH_CREATED',
    'SCHEDULE_SET',
    'STAFF_ADDED',
    'COMPLETED',
  ])
  .describe('Tenant onboarding stage');

export const updateTenantSchema = z.object({
  status: tenantStatusSchema.optional().describe('New tenant status'),
  onboardingStatus: tenantOnboardingSchema
    .optional()
    .describe('New onboarding stage'),
  planId: z.string().trim().min(1).optional().describe('Assigned plan ID'),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('IANA timezone'),
  settings: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Tenant settings key/value object'),
});

export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;

export const listTenantsSchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe('Search tenants by name/company'),
  status: tenantStatusSchema.optional().describe('Filter by tenant status'),
  planId: z.string().trim().min(1).optional().describe('Filter by plan ID'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum tenants to return (1-100, default 20)'),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Pagination offset (default 0)'),
});

export type ListTenantsDto = z.infer<typeof listTenantsSchema>;

export const createTenantSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe('Company name for the new tenant'),
  planCode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .describe('Pricing plan code (defaults to "free")'),
  adminFirstName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Company admin's first name"),
  adminLastName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Company admin's last name"),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(255)
    .describe("Company admin's email address"),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
