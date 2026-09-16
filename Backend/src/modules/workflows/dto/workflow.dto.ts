import { z } from 'zod';

export const workflowActionSchema = z.enum([
  'SUBMISSION',
  'APPROVE',
  'REJECT',
  'ACKNOWLEDGE',
  'PROVIDE_INFO',
  'EXECUTION',
  'CLOSURE',
]);

export const assigneeRuleTypeSchema = z.enum([
  'COMPANY_ROLE',
  'USER',
  'ORIGINATOR_MANAGER',
]);

export const escalationTypeSchema = z.enum([
  'AUTO_ACTION',
  'NOTIFY',
  'REASSIGN',
]);

export const escalationTriggerSchema = z.enum([
  'NO_RESPONSE',
  'ABSENT',
  'TIMEOUT',
]);

export const escalationActionSchema = z.enum([
  'APPROVE',
  'REJECT',
  'SKIP',
  'NOTIFY_ADMIN',
]);

export const escalationRuleSchema = z.object({
  type: escalationTypeSchema.describe('Escalation type'),
  trigger: escalationTriggerSchema.describe('What triggers the escalation'),
  timeoutMinutes: z
    .number()
    .int()
    .min(1)
    .describe('Minutes to wait before escalating'),
  action: escalationActionSchema.describe('Action to take on escalation'),
  targetUserId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Target user for NOTIFY/REASSIGN (optional)'),
  priority: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Priority order (lower = evaluated first)'),
});

export type EscalationRuleDto = z.infer<typeof escalationRuleSchema>;

export const workflowStepSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Step name is required')
    .max(200)
    .describe('Step name'),
  order: z.number().int().min(0).describe('Step order within the workflow'),
  action: workflowActionSchema
    .default('APPROVE')
    .describe('Action taken at this step'),
  assigneeRuleType: assigneeRuleTypeSchema
    .default('COMPANY_ROLE')
    .describe('How the assignee is determined'),
  assigneeCompanyRoleId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Company role ID (for COMPANY_ROLE rule)'),
  assigneeUserId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('User ID (for USER rule)'),
  isFinal: z
    .boolean()
    .default(false)
    .describe('Whether this is the final step'),
  isRequired: z
    .boolean()
    .default(true)
    .describe('Whether this step must be manually acted on'),
  dueInMinutes: z
    .number()
    .int()
    .min(1)
    .optional()
    .nullable()
    .describe('SLA deadline in minutes (used for escalation trigger)'),
  escalationRules: z
    .array(escalationRuleSchema)
    .max(10)
    .optional()
    .describe('Escalation rules for this step'),
});

export type WorkflowStepDto = z.infer<typeof workflowStepSchema>;

export const createWorkflowTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Template name is required')
    .max(200)
    .describe('Template name'),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Template description (max 2000 characters)'),
  branchId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional branch the template belongs to'),
  formId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional form ID linked to this workflow'),
  steps: z
    .array(workflowStepSchema)
    .min(1, 'At least one step is required')
    .describe('Workflow steps (at least one)'),
});

export type CreateWorkflowTemplateDto = z.infer<
  typeof createWorkflowTemplateSchema
>;

export const updateWorkflowTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Template name is required')
    .max(200)
    .optional()
    .describe('Template name'),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Template description (max 2000 characters)'),
  isActive: z.boolean().optional().describe('Whether the template is active'),
  formId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe('Optional form ID linked to this workflow'),
  steps: z
    .array(workflowStepSchema)
    .min(1)
    .optional()
    .describe('Workflow steps (at least one)'),
});

export type UpdateWorkflowTemplateDto = z.infer<
  typeof updateWorkflowTemplateSchema
>;

export const listWorkflowTemplatesSchema = z.object({
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  active: z
    .enum(['true', 'false'])
    .optional()
    .describe('Filter by active state'),
});

export type ListWorkflowTemplatesDto = z.infer<
  typeof listWorkflowTemplatesSchema
>;

export const startWorkflowInstanceSchema = z.object({
  templateId: z
    .string()
    .trim()
    .min(1, 'templateId is required')
    .describe('Workflow template ID to instantiate'),
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
  refNumber: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .nullable()
    .describe('Unique reference number for this workflow instance'),
  parentRefNumber: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .nullable()
    .describe(
      'REFF of the parent Customer Ticket submission this workflow is bundled under',
    ),
  submissionId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .describe(
      'Optional ID of the FormSubmission this workflow instance is linked to',
    ),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Custom payload for the workflow'),
});

export type StartWorkflowInstanceDto = z.infer<
  typeof startWorkflowInstanceSchema
>;

export const workflowStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const listWorkflowInstancesSchema = z.object({
  status: workflowStatusSchema.optional().describe('Filter by status'),
  templateId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Filter by template ID'),
  branchId: z.string().trim().min(1).optional().describe('Filter by branch ID'),
  mine: z
    .enum(['true'])
    .optional()
    .describe('Filter to instances assigned to the current user'),
});

export type ListWorkflowInstancesDto = z.infer<
  typeof listWorkflowInstancesSchema
>;

export const workflowActionBodySchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .describe('Optional note for the action (max 2000 characters)'),
    formData: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Structured form data for the step'),
  })
  .default({});

export type WorkflowActionBodyDto = z.infer<typeof workflowActionBodySchema>;

export const delegateStepSchema = z.object({
  delegatedToUserId: z
    .string()
    .trim()
    .min(1, 'delegatedToUserId is required')
    .describe('User ID to delegate the step to'),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe('Optional delegation note'),
});

export type DelegateStepDto = z.infer<typeof delegateStepSchema>;
