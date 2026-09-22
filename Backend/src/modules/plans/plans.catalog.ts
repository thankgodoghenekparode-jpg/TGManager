import type { Prisma } from '../../generated/prisma/client';
import {
  PERMISSIONS,
  type Permission,
} from '../rbac/permissions/permissions.constants';

const B = PERMISSIONS;
const BYTE = 1024n ** 3n;

export interface PlanTier {
  code: string;
  name: string;
  priceCents: number;
  pricePerSeatCents: number | null;
  billingCycle: 'monthly' | 'yearly';
  maxBranches: number | null;
  maxStaff: number | null;
  maxDocuments: number | null;
  maxStorageBytes: bigint | null;
  maxChatMessages: number | null;
  permissions: readonly Permission[];
  features: readonly string[];
  highlight?: string;
}

/** Starter: daily operations for a small team. */
const STARTER_PERMISSIONS = [
  B.TENANT_VIEW,
  B.BRANCH_VIEW,
  B.BRANCH_CREATE,
  B.BRANCH_UPDATE,
  B.BRANCH_DELETE,
  B.DEPARTMENT_VIEW,
  B.DEPARTMENT_CREATE,
  B.DEPARTMENT_UPDATE,
  B.DEPARTMENT_DELETE,
  B.GROUP_VIEW,
  B.GROUP_CREATE,
  B.GROUP_UPDATE,
  B.GROUP_DELETE,
  B.STAFF_VIEW,
  B.STAFF_CREATE,
  B.STAFF_UPDATE,
  B.STAFF_DELETE,
  B.STAFF_ASSIGN_ROLE,
  B.ROLE_VIEW,
  B.ROLE_CREATE,
  B.ROLE_UPDATE,
  B.ROLE_DELETE,
  B.ROLE_ASSIGN,
  B.ATTENDANCE_CLOCK_IN,
  B.ATTENDANCE_CLOCK_OUT,
  B.ATTENDANCE_VIEW,
  B.ATTENDANCE_MANAGE,
  B.SCHEDULE_MANAGE,
  B.MEMO_VIEW,
  B.MEMO_CREATE,
  B.MEMO_MANAGE,
  B.FORM_VIEW,
  B.FORM_CREATE,
  B.FORM_MANAGE,
  B.FORM_SUBMIT,
  B.CHAT_CREATE,
  B.CHAT_VIEW,
  B.REPORT_VIEW,
  B.REPORT_SUBMIT,
] as const satisfies readonly Permission[];

/** Pro: documents, inventory, workflows, audit. */
const PRO_PERMISSIONS = [
  ...STARTER_PERMISSIONS,
  B.TENANT_MANAGE,
  B.DOCUMENT_VIEW,
  B.DOCUMENT_CREATE,
  B.DOCUMENT_UPDATE,
  B.DOCUMENT_DELETE,
  B.INVENTORY_VIEW,
  B.INVENTORY_MANAGE,
  B.WORKFLOW_VIEW,
  B.WORKFLOW_CREATE,
  B.WORKFLOW_SUBMIT,
  B.WORKFLOW_APPROVE,
  B.WORKFLOW_EXECUTE,
  B.REPORT_MANAGE,
  B.AUDIT_VIEW,
] as const satisfies readonly Permission[];

/** Enterprise: everything including integrations. */
const ENTERPRISE_PERMISSIONS = [
  ...PRO_PERMISSIONS,
  B.INTEGRATION_MANAGE,
] as const satisfies readonly Permission[];

const STARTER_FEATURES = [
  'Staff, branches, departments & groups',
  'Attendance & schedules',
  'Memos & announcements',
  'Forms & submissions',
  'Team chat',
  'Reports: view & submit',
];

const PRO_FEATURES = [
  ...STARTER_FEATURES,
  'Document management, sharing & grants',
  'Inventory tracking',
  'Approval workflows',
  'Audit log',
  'Tenant settings',
];

const ENTERPRISE_FEATURES = [
  ...PRO_FEATURES,
  'Integrations (API keys & webhooks)',
  'Unlimited branches & staff',
];

/**
 * The 3-tier pricing catalog. Single source of truth for default plan rows
 * (seeded by PlansService.ensureDefaultPlans), permission-based feature gating,
 * and the public pricing payload served by GET /plans.
 */
export const PLAN_TIERS: readonly PlanTier[] = [
  {
    code: 'free',
    name: 'Starter',
    priceCents: 0,
    pricePerSeatCents: null,
    billingCycle: 'monthly',
    maxBranches: 1,
    maxStaff: 10,
    maxDocuments: 500,
    maxStorageBytes: 5n * BYTE,
    maxChatMessages: 100_000,
    permissions: STARTER_PERMISSIONS,
    features: STARTER_FEATURES,
  },
  {
    code: 'pro',
    name: 'Pro',
    priceCents: 4900,
    pricePerSeatCents: null,
    billingCycle: 'monthly',
    maxBranches: 5,
    maxStaff: 100,
    maxDocuments: 5000,
    maxStorageBytes: 50n * BYTE,
    maxChatMessages: 1_000_000,
    permissions: PRO_PERMISSIONS,
    highlight: 'Most popular',
    features: PRO_FEATURES,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceCents: 14900,
    pricePerSeatCents: null,
    billingCycle: 'monthly',
    maxBranches: null,
    maxStaff: null,
    maxDocuments: null,
    maxStorageBytes: null,
    maxChatMessages: null,
    permissions: ENTERPRISE_PERMISSIONS,
    highlight: 'Unlimited',
    features: ENTERPRISE_FEATURES,
  },
] as const;

export const PLAN_BY_CODE: ReadonlyMap<string, PlanTier> = new Map(
  PLAN_TIERS.map((t) => [t.code, t]),
);

/**
 * Feature flags persisted onto a plan row. Legacy boolean switches are kept for
 * compatibility; `permissions` is the authoritative tier gate.
 */
export function tierFeatureFlags(tier: PlanTier): Prisma.JsonValue {
  return {
    chat: true,
    workflows: tier.code !== 'free',
    reports: true,
    inventory: tier.code !== 'free',
    permissions: [...tier.permissions],
  };
}

/**
 * Whether a plan grants a given company permission. Unknown plan codes are
 * treated as permissive so platform-defined plans never silently lock users out.
 */
export function planAllows(
  plan: { code: string; featureFlags: Prisma.JsonValue | null | undefined },
  permission: Permission,
): boolean {
  const raw = plan.featureFlags as { permissions?: string[] } | null;
  const permissions =
    raw?.permissions ?? PLAN_BY_CODE.get(plan.code)?.permissions;
  if (!permissions) return true;
  return (permissions as readonly string[]).includes(permission);
}
