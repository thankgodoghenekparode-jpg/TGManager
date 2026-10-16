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

/**
 * Permission groups for the school workspace. A nav item or route is shown /
 * allowed when the signed-in user holds at least one permission in its block.
 * The sets below mirror the backend school controllers' `@Permissions(...)`
 * decorators so the sidebar, the route guards and the API agree on access.
 */
export const SchoolPermissionBlocks = {
  DASHBOARD: ['school.view'],
  STUDENTS: ['student.view', 'student.manage'],
  CLASSES: ['school.manage', 'academic.view', 'academic.manage'],
  GATE_ATTENDANCE: ['school_attendance.view', 'school_attendance.manage'],
  STAFF_ATTENDANCE: [
    'school_staff_attendance.view',
    'school_staff_attendance.manage',
    'attendance.clock_in',
    'attendance.clock_out',
  ],
  GRADING: ['academic.view', 'academic.manage'],
  TIMETABLE: ['academic.view', 'academic.manage'],
  FEES: ['school_fee.view', 'school_fee.manage'],
  STAFF: ['school.manage', 'staff.view', 'staff.create', 'staff.update'],
  PARENTS: ['school.manage', 'school.parent_view'],
  CHAT: ['chat.view', 'chat.create'],
  ANNOUNCEMENTS: ['school.view', 'school.manage'],
  SETTINGS: ['tenant.manage', 'school.manage'],
} as const
