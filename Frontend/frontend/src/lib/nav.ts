/** Permission groups derived from the backend permission catalog. */
export const PermissionBlocks = {
  BRANCH: ['branch.view', 'branch.create', 'branch.update', 'branch.delete'],
  DEPARTMENT: ['department.view', 'department.create', 'department.update', 'department.delete'],
  GROUP: ['group.view', 'group.create', 'group.update', 'group.delete'],
  STAFF: ['staff.view', 'staff.create', 'staff.update', 'staff.delete', 'staff.assign_role'],
  ROLE: ['role.view', 'role.create', 'role.update', 'role.delete', 'role.assign'],
  ATTENDANCE: ['attendance.clock_in', 'attendance.clock_out', 'attendance.view', 'attendance.manage'],
  DOCUMENT: ['document.view', 'document.create', 'document.update', 'document.delete'],
  INVENTORY: ['inventory.view', 'inventory.manage'],
  MEMO: ['memo.view', 'memo.create', 'memo.manage'],
  REPORT: ['report.view', 'report.submit', 'report.manage'],
  FORM: ['form.view', 'form.create', 'form.manage', 'form.submit'],
  WORKFLOW: ['workflow.view', 'workflow.create', 'workflow.submit', 'workflow.approve'],
  AUDIT: ['audit.view'],
  INTEGRATION: ['integration.manage'],
  SETTINGS: ['tenant.manage'],
} as const
