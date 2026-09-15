import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100)
    .describe('API key name'),
  permissions: z
    .array(z.string().trim().min(1))
    .max(20)
    .optional()
    .describe('Permission strings for this key'),
});

export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;

export const createWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL').describe('Webhook endpoint URL'),
  secret: z
    .string()
    .trim()
    .min(16, 'Secret must be at least 16 characters')
    .max(200)
    .describe('HMAC signing secret'),
  events: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one event is required')
    .max(20)
    .describe('Event types to subscribe to'),
});

export type CreateWebhookDto = z.infer<typeof createWebhookSchema>;

export const integrationStartWorkflowSchema = z.object({
  templateId: z
    .string()
    .trim()
    .min(1, 'templateId is required')
    .describe('Workflow template ID'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(300)
    .describe('Workflow instance title'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch scope'),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Custom payload'),
});

export type IntegrationStartWorkflowDto = z.infer<
  typeof integrationStartWorkflowSchema
>;

export const integrationStepDataSchema = z.object({
  formData: z
    .record(z.string(), z.unknown())
    .describe('Structured form data for the step'),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Optional note'),
});

export type IntegrationStepDataDto = z.infer<typeof integrationStepDataSchema>;

export const listDeliveriesSchema = z.object({
  status: z
    .enum(['PENDING', 'DELIVERED', 'FAILED'])
    .optional()
    .describe('Filter by delivery status'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Max results'),
});

export type ListDeliveriesDto = z.infer<typeof listDeliveriesSchema>;
