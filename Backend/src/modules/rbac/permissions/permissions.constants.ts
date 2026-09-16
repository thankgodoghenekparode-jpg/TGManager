/**
 * Granular permission catalog used by company roles.
 * Keys are stored as strings on CompanyRole.permissions.
 */
export const PERMISSIONS = {
  TENANT_VIEW: 'tenant.view',
  TENANT_MANAGE: 'tenant.manage',

  BRANCH_VIEW: 'branch.view',
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_DELETE: 'branch.delete',

  DEPARTMENT_VIEW: 'department.view',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DELETE: 'department.delete',

  GROUP_VIEW: 'group.view',
  GROUP_CREATE: 'group.create',
  GROUP_UPDATE: 'group.update',
  GROUP_DELETE: 'group.delete',

  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',
  STAFF_ASSIGN_ROLE: 'staff.assign_role',

  ROLE_VIEW: 'role.view',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',

  ATTENDANCE_CLOCK_IN: 'attendance.clock_in',
  ATTENDANCE_CLOCK_OUT: 'attendance.clock_out',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',

  SCHEDULE_MANAGE: 'schedule.manage',

  DOCUMENT_VIEW: 'document.view',
  DOCUMENT_CREATE: 'document.create',
  DOCUMENT_UPDATE: 'document.update',
  DOCUMENT_DELETE: 'document.delete',

  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',

  MEMO_VIEW: 'memo.view',
  MEMO_CREATE: 'memo.create',
  MEMO_MANAGE: 'memo.manage',

  FORM_VIEW: 'form.view',
  FORM_CREATE: 'form.create',
  FORM_MANAGE: 'form.manage',
  FORM_SUBMIT: 'form.submit',

  REPORT_VIEW: 'report.view',
  REPORT_SUBMIT: 'report.submit',
  REPORT_MANAGE: 'report.manage',

  WORKFLOW_VIEW: 'workflow.view',
  WORKFLOW_CREATE: 'workflow.create',
  WORKFLOW_SUBMIT: 'workflow.submit',
  WORKFLOW_APPROVE: 'workflow.approve',
  WORKFLOW_EXECUTE: 'workflow.execute',

  CHAT_CREATE: 'chat.create',
  CHAT_VIEW: 'chat.view',

  INTEGRATION_MANAGE: 'integration.manage',

  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] =
  Object.values(PERMISSIONS);
