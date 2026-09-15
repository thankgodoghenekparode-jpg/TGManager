import { api } from './client'
import type { FormField } from './forms'

export type WorkflowStepAction =
  | 'SUBMISSION'
  | 'APPROVE'
  | 'REJECT'
  | 'ACKNOWLEDGE'
  | 'PROVIDE_INFO'
  | 'EXECUTION'
  | 'CLOSURE'
export type AssigneeRuleType = 'COMPANY_ROLE' | 'USER' | 'ORIGINATOR_MANAGER'
export type WorkflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface WorkflowStep {
  id?: string
  name: string
  order: number
  action: WorkflowStepAction
  assigneeRuleType: AssigneeRuleType
  assigneeCompanyRoleId?: string | null
  assigneeUserId?: string | null
  isFinal?: boolean
  isRequired?: boolean
  dueInMinutes?: number
  escalationRules?: Array<{
    type: 'AUTO_ACTION' | 'NOTIFY'
    trigger: 'TIMEOUT'
    timeoutMinutes: number
    action?: WorkflowStepAction | 'NOTIFY_ADMIN'
    priority?: number
  }>
}

export interface WorkflowTemplate {
  id: string
  tenantId: string
  branchId: string | null
  name: string
  description: string | null
  formId: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  steps: WorkflowStep[]
  form?: { id: string; name: string; fields: FormField[] }
  _count?: { instances: number }
}

export interface WorkflowStepInstance {
  id: string
  instanceId: string
  stepId: string
  status: string
  assignedToUserId: string | null
  actionedByUserId: string | null
  actionedAt: string | null
  note: string | null
  step?: WorkflowStep
  assignedToUser?: { id: string; firstName: string; lastName: string; email: string }
  actionedBy?: { id: string; firstName: string; lastName: string; email: string }
}

export interface WorkflowInstance {
  id: string
  tenantId: string
  templateId: string
  branchId: string | null
  title: string
  status: WorkflowStatus
  refNumber: string | null
  parentRefNumber: string | null
  payload: Record<string, unknown> | null
  initiatedByUserId: string
  currentStepId: string | null
  createdAt: string
  updatedAt: string
  template?: WorkflowTemplate
  branch?: { id: string; name: string }
  initiatedByUser?: { id: string; firstName: string; lastName: string; email: string }
  stepInstances?: WorkflowStepInstance[]
  stepRoleKey?: string | null
  currentStepAction?: WorkflowStepAction | null
  currentStepName?: string | null
  canAct?: boolean
  submission?: {
    id: string
    refNumber: string | null
    parentRefNumber: string | null
    formId: string
    data: Record<string, unknown>
  }
}

export interface CreateWorkflowTemplateInput {
  name: string
  description?: string | null
  branchId?: string | null
  formId?: string | null
  steps: WorkflowStep[]
}

export interface StartWorkflowInput {
  templateId: string
  title: string
  branchId?: string | null
  refNumber?: string | null
  parentRefNumber?: string | null
  submissionId?: string | null
  payload?: Record<string, unknown>
}

export const WORKFLOW_START_ROLE_RE = /secretary|account.{0,14}assist/i

export function canStartWorkflow(roles: readonly { name: string }[]): boolean {
  return roles.some((r) => WORKFLOW_START_ROLE_RE.test(r.name))
}

export const workflowsApi = {
  listTemplates(query?: { branchId?: string; active?: boolean }) {
    return api.get<WorkflowTemplate[]>('/workflows/templates', { params: query }).then((r) => r.data)
  },
  getTemplate(id: string) {
    return api.get<WorkflowTemplate>(`/workflows/templates/${id}`).then((r) => r.data)
  },
  createTemplate(body: CreateWorkflowTemplateInput) {
    return api.post<WorkflowTemplate>('/workflows/templates', body).then((r) => r.data)
  },
  updateTemplate(id: string, body: Partial<CreateWorkflowTemplateInput & { isActive?: boolean }>) {
    return api.patch<WorkflowTemplate>(`/workflows/templates/${id}`, body).then((r) => r.data)
  },
  removeTemplate(id: string) {
    return api.delete(`/workflows/templates/${id}`).then(() => undefined)
  },
  approvals() {
    return api.get<WorkflowInstance[]>('/workflows/approvals').then((r) => r.data)
  },
  listInstances(query?: { status?: WorkflowStatus; templateId?: string; branchId?: string; mine?: boolean }) {
    return api.get<WorkflowInstance[]>('/workflows/instances', { params: query }).then((r) => r.data)
  },
  getInstance(id: string) {
    return api.get<WorkflowInstance>(`/workflows/instances/${id}`).then((r) => r.data)
  },
  start(body: StartWorkflowInput) {
    return api.post<WorkflowInstance>('/workflows/instances', body).then((r) => r.data)
  },
  approve(id: string, body?: { note?: string; formData?: Record<string, unknown> }) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/approve`, body ?? {}).then((r) => r.data)
  },
  reject(id: string, body?: { note?: string; formData?: Record<string, unknown> }) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/reject`, body ?? {}).then((r) => r.data)
  },
  execute(id: string, body?: { note?: string; formData?: Record<string, unknown> }) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/execute`, body ?? {}).then((r) => r.data)
  },
  cancel(id: string) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/cancel`).then((r) => r.data)
  },
  complete(id: string, body?: { note?: string; formData?: Record<string, unknown> }) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/complete`, body ?? {}).then((r) => r.data)
  },
  delegate(id: string, delegatedToUserId: string, note?: string) {
    return api.post<WorkflowInstance>(`/workflows/instances/${id}/delegate`, { delegatedToUserId, note }).then((r) => r.data)
  },
}