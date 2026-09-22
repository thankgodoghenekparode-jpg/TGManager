import { z } from 'zod';
import { checkoutSchema } from '../../modules/billing/dto/billing.dto';
import { loginSchema } from '../../modules/auth/dto/login.dto';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../modules/auth/dto/password.dto';
import { saveSettingsSchema } from '../../modules/settings/dto/settings.dto';
import {
  clockInSchema,
  clockOutSchema,
  updateAttendanceSchema,
} from '../../modules/attendance/dto/attendance.dto';
import {
  createBranchSchema,
  updateBranchSchema,
} from '../../modules/branches/dto/branch.dto';
import {
  createConversationSchema,
  sendMessageSchema,
} from '../../modules/chat/dto/chat.dto';
import {
  assignRoleSchema,
  createCompanyRoleSchema,
  updateCompanyRoleSchema,
} from '../../modules/company-roles/dto/company-role.dto';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../../modules/departments/dto/department.dto';
import {
  createDocumentSchema,
  grantDocumentSchema,
  updateDocumentSchema,
} from '../../modules/documents/dto/document.dto';
import {
  createFormSchema,
  submitFormSchema,
  updateFormSchema,
} from '../../modules/forms/dto/form.dto';
import {
  createGroupSchema,
  groupMembersSchema,
  updateGroupSchema,
} from '../../modules/groups/dto/group.dto';
import {
  adjustInventorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from '../../modules/inventory/dto/inventory.dto';
import {
  createMemoSchema,
  updateMemoSchema,
} from '../../modules/memos/dto/memo.dto';
import {
  createPlanSchema,
  createPlatformUserSchema,
  updatePlanSchema,
  updatePlatformUserSchema,
  updateTenantSchema,
} from '../../modules/platform/dto/platform.dto';
import { platformSettingsSchema } from '../../modules/platform/dto/platform-settings.dto';
import {
  createEmailChangeSchema,
  createPasswordResetRequestSchema,
  rejectRequestSchema,
} from '../../modules/account-requests/dto/account-request.dto';
import {
  createScheduleSchema,
  updateScheduleSchema,
} from '../../modules/schedules/dto/schedule.dto';
import {
  assignRolesSchema,
  createStaffSchema,
  updateStaffSchema,
} from '../../modules/staff/dto/staff.dto';
import {
  createWorkflowTemplateSchema,
  delegateStepSchema,
  startWorkflowInstanceSchema,
  updateWorkflowTemplateSchema,
  workflowActionBodySchema,
} from '../../modules/workflows/dto/workflow.dto';
import {
  createApiKeySchema,
  createWebhookSchema,
  integrationStartWorkflowSchema,
  integrationStepDataSchema,
} from '../../modules/integrations/dto/integration.dto';
import {
  reviewWeeklyReportSchema,
  submitWeeklyReportSchema,
  updateWeeklyReportSchema,
} from '../../modules/weekly-reports/dto/weekly-report.dto';

/**
 * Registry of all request-body DTO schemas, keyed by the name used both in
 * `#/components/schemas/<name>` refs and in the Swagger UI "Schemas" section.
 */
export const DTO_SCHEMAS: Record<string, z.ZodTypeAny> = {
  LoginDto: loginSchema,
  ChangePasswordDto: changePasswordSchema,
  ForgotPasswordDto: forgotPasswordSchema,
  ResetPasswordDto: resetPasswordSchema,
  SaveSettingsDto: saveSettingsSchema,
  CreateBranchDto: createBranchSchema,
  UpdateBranchDto: updateBranchSchema,
  CreateStaffDto: createStaffSchema,
  UpdateStaffDto: updateStaffSchema,
  AssignRolesDto: assignRolesSchema,
  CreateScheduleDto: createScheduleSchema,
  UpdateScheduleDto: updateScheduleSchema,
  CreateDepartmentDto: createDepartmentSchema,
  UpdateDepartmentDto: updateDepartmentSchema,
  ClockInDto: clockInSchema,
  ClockOutDto: clockOutSchema,
  UpdateAttendanceDto: updateAttendanceSchema,
  CreateConversationDto: createConversationSchema,
  SendMessageDto: sendMessageSchema,
  CreateCompanyRoleDto: createCompanyRoleSchema,
  UpdateCompanyRoleDto: updateCompanyRoleSchema,
  AssignCompanyRoleDto: assignRoleSchema,
  CreateFormDto: createFormSchema,
  UpdateFormDto: updateFormSchema,
  SubmitFormDto: submitFormSchema,
  CreateGroupDto: createGroupSchema,
  UpdateGroupDto: updateGroupSchema,
  GroupMembersDto: groupMembersSchema,
  CreateInventoryItemDto: createInventoryItemSchema,
  UpdateInventoryItemDto: updateInventoryItemSchema,
  AdjustInventoryDto: adjustInventorySchema,
  CreateMemoDto: createMemoSchema,
  UpdateMemoDto: updateMemoSchema,
  CreateDocumentDto: createDocumentSchema,
  UpdateDocumentDto: updateDocumentSchema,
  GrantDocumentDto: grantDocumentSchema,
  CreatePlanDto: createPlanSchema,
  UpdatePlanDto: updatePlanSchema,
  CreatePlatformUserDto: createPlatformUserSchema,
  UpdatePlatformUserDto: updatePlatformUserSchema,
  PlatformSettingsDto: platformSettingsSchema,
  UpdateTenantDto: updateTenantSchema,
  CreateEmailChangeDto: createEmailChangeSchema,
  CreatePasswordResetRequestDto: createPasswordResetRequestSchema,
  RejectRequestDto: rejectRequestSchema,
  CreateWorkflowTemplateDto: createWorkflowTemplateSchema,
  UpdateWorkflowTemplateDto: updateWorkflowTemplateSchema,
  StartWorkflowInstanceDto: startWorkflowInstanceSchema,
  WorkflowActionBodyDto: workflowActionBodySchema,
  DelegateStepDto: delegateStepSchema,
  CreateApiKeyDto: createApiKeySchema,
  CreateWebhookDto: createWebhookSchema,
  IntegrationStartWorkflowDto: integrationStartWorkflowSchema,
  IntegrationStepDataDto: integrationStepDataSchema,
  SubmitWeeklyReportDto: submitWeeklyReportSchema,
  UpdateWeeklyReportDto: updateWeeklyReportSchema,
  ReviewWeeklyReportDto: reviewWeeklyReportSchema,
  StartCheckoutDto: checkoutSchema,
};

/**
 * Multipart bodies that merge an uploaded `file` with optional DTO fields.
 * Registered under their key name in `components.schemas`.
 */
export interface MultipartBodySchema {
  /** DTO whose fields are merged under the binary file; omit for file-only bodies. */
  base?: z.ZodTypeAny;
  fileDescription: string;
}

export const MULTIPART_BODY_SCHEMAS: Record<string, MultipartBodySchema> = {
  CreateDocumentDto: {
    base: createDocumentSchema,
    fileDescription: 'Document file (max 25 MB)',
  },
  UploadDocumentVersionDto: {
    fileDescription: 'New file version (max 25 MB)',
  },
};
