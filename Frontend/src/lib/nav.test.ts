import { describe, expect, it } from 'vitest'
import { SchoolPermissionBlocks } from './nav'
import { hasPermission } from '../components/PermissionGate'

/**
 * Role permission sets mirror Backend/src/modules/rbac/system-roles/system-roles.constants.ts.
 * These lock in the frontend visibility matrix so a school role can never
 * silently regain access to sections it is not meant to see.
 *
 * PRINCIPAL is seeded with ALL_PERMISSIONS on the backend (the principal has the
 * same access as the school administrator); the subset below still covers every
 * nav section, which is what this matrix asserts.
 */
const PRINCIPAL = [
  'tenant.view', 'tenant.manage', 'school.view', 'school.manage',
  'student.view', 'student.manage', 'academic.view', 'academic.manage',
  'school_fee.view', 'school_fee.manage', 'school_attendance.view', 'school_attendance.manage',
  'school_staff_attendance.view', 'school_staff_attendance.manage',
  'attendance.clock_in', 'attendance.clock_out',
  'staff.view', 'staff.create', 'staff.update', 'staff.delete', 'staff.assign_role',
  'role.view', 'role.assign', 'chat.create', 'chat.view',
  'document.view', 'document.create', 'memo.view', 'memo.create', 'memo.manage', 'report.view',
  'cbt.view', 'cbt.take', 'cbt.question_view', 'cbt.question_manage',
  'cbt.exam_view', 'cbt.exam_manage', 'cbt.result_view',
]

const TEACHER = [
  'school.view', 'student.view', 'academic.view', 'academic.manage',
  'school_attendance.view', 'school_attendance.manage', 'school_staff_attendance.view',
  'attendance.clock_in', 'attendance.clock_out',
  'chat.create', 'chat.view', 'document.view', 'document.create', 'memo.view',
  'cbt.view', 'cbt.question_view', 'cbt.question_manage',
  'cbt.exam_view', 'cbt.exam_manage', 'cbt.result_view',
]

const ACCOUNTANT = [
  'school.view', 'student.view', 'school_fee.view', 'school_fee.manage',
  'school_staff_attendance.view', 'attendance.clock_in', 'attendance.clock_out',
  'chat.create', 'chat.view', 'document.view', 'report.view',
]

const GATE_OFFICER = [
  'school.view', 'student.view', 'school_attendance.view', 'school_attendance.manage',
  'school_staff_attendance.view', 'attendance.clock_in', 'attendance.clock_out',
  'chat.create', 'chat.view',
]

function visibleSections(permissions: string[]): string[] {
  return Object.entries(SchoolPermissionBlocks)
    .filter(([, block]) =>
      hasPermission({ tenantPermissions: permissions, required: block }),
    )
    .map(([key]) => key)
}

describe('school role visibility matrix', () => {
  it('principal has full access to every section', () => {
    expect(visibleSections(PRINCIPAL).sort()).toEqual(
      Object.keys(SchoolPermissionBlocks).sort(),
    )
  })

  it('teacher sees academics and attendance but not fees, staff, parents or settings', () => {
    const sections = visibleSections(TEACHER)
    expect(sections).toEqual(
      expect.arrayContaining(['DASHBOARD', 'STUDENTS', 'CLASSES', 'GATE_ATTENDANCE', 'STAFF_ATTENDANCE', 'GRADING', 'TIMETABLE', 'CHAT', 'ANNOUNCEMENTS']),
    )
    expect(sections).not.toContain('FEES')
    expect(sections).not.toContain('STAFF')
    expect(sections).not.toContain('PARENTS')
    expect(sections).not.toContain('SETTINGS')
  })

  it('teacher manages CBT but never takes examinations', () => {
    const sections = visibleSections(TEACHER)
    expect(sections).toEqual(
      expect.arrayContaining(['CBT', 'CBT_BANK', 'CBT_EXAMS', 'CBT_REPORTS']),
    )
    expect(sections).not.toContain('CBT_TAKE')
  })

  it('accountant sees fees but not academics, classes or gate attendance', () => {
    const sections = visibleSections(ACCOUNTANT)
    expect(sections).toEqual(
      expect.arrayContaining(['DASHBOARD', 'STUDENTS', 'STAFF_ATTENDANCE', 'FEES', 'CHAT', 'ANNOUNCEMENTS']),
    )
    expect(sections).not.toContain('CLASSES')
    expect(sections).not.toContain('GRADING')
    expect(sections).not.toContain('TIMETABLE')
    expect(sections).not.toContain('GATE_ATTENDANCE')
    expect(sections).not.toContain('STAFF')
    expect(sections).not.toContain('SETTINGS')
  })

  it('gate officer sees attendance but not fees, academics or classes', () => {
    const sections = visibleSections(GATE_OFFICER)
    expect(sections).toEqual(
      expect.arrayContaining(['DASHBOARD', 'STUDENTS', 'GATE_ATTENDANCE', 'STAFF_ATTENDANCE', 'CHAT', 'ANNOUNCEMENTS']),
    )
    expect(sections).not.toContain('FEES')
    expect(sections).not.toContain('CLASSES')
    expect(sections).not.toContain('GRADING')
    expect(sections).not.toContain('TIMETABLE')
    expect(sections).not.toContain('STAFF')
    expect(sections).not.toContain('SETTINGS')
  })

  it('platform and company admins bypass permission checks', () => {
    expect(hasPermission({ role: 'SUPER_ADMIN', required: ['school.manage'] })).toBe(true)
    expect(hasPermission({ isCompanyAdmin: true, required: ['school.manage'] })).toBe(true)
  })

  it('an empty requirement is always allowed', () => {
    expect(hasPermission({ tenantPermissions: [], required: [] })).toBe(true)
  })
})
