import { describe, it, expect } from '@jest/globals';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  type Permission,
} from '../rbac/permissions/permissions.constants';
import {
  PLAN_TIERS,
  PLAN_BY_CODE,
  planAllows,
  tierFeatureFlags,
} from './plans.catalog';

describe('plans catalog', () => {
  it('defines exactly three tiers in ascending price order', () => {
    expect(PLAN_TIERS.map((t) => t.code)).toEqual([
      'free',
      'pro',
      'enterprise',
    ]);
    expect(PLAN_TIERS[0].priceCents < PLAN_TIERS[1].priceCents).toBe(true);
    expect(PLAN_TIERS[1].priceCents < PLAN_TIERS[2].priceCents).toBe(true);
  });

  it('keeps permission grants monotonic across tiers', () => {
    const keys = (code: string) =>
      new Set(PLAN_BY_CODE.get(code)!.permissions as string[]);
    const free = keys('free');
    const pro = keys('pro');
    const enterprise = keys('enterprise');
    for (const p of free) expect(pro.has(p)).toBe(true);
    for (const p of pro) expect(enterprise.has(p)).toBe(true);
  });

  it('covers the full permission catalog across all tiers', () => {
    const granted = new Set(
      PLAN_TIERS.flatMap((t) => [...t.permissions]) as string[],
    );
    for (const permission of ALL_PERMISSIONS) {
      expect(granted.has(permission)).toBe(true);
    }
  });

  it('gates modules by tier: docs/workflow require Pro, integrations require Enterprise', () => {
    expect(planAllows(planRow('free'), PERMISSIONS.DOCUMENT_CREATE)).toBe(
      false,
    );
    expect(planAllows(planRow('free'), PERMISSIONS.WORKFLOW_APPROVE)).toBe(
      false,
    );
    expect(planAllows(planRow('pro'), PERMISSIONS.DOCUMENT_CREATE)).toBe(true);
    expect(planAllows(planRow('pro'), PERMISSIONS.AUDIT_VIEW)).toBe(true);
    expect(planAllows(planRow('pro'), PERMISSIONS.INTEGRATION_MANAGE)).toBe(
      false,
    );
    expect(
      planAllows(planRow('enterprise'), PERMISSIONS.INTEGRATION_MANAGE),
    ).toBe(true);
  });

  it('allows core operations on every tier', () => {
    expect(planAllows(planRow('free'), PERMISSIONS.STAFF_CREATE)).toBe(true);
    expect(planAllows(planRow('free'), PERMISSIONS.CHAT_CREATE)).toBe(true);
    expect(planAllows(planRow('free'), PERMISSIONS.FORM_SUBMIT)).toBe(true);
  });

  it('is permissive for unknown (platform-defined) plans', () => {
    expect(
      planAllows(
        { code: 'custom-plan', featureFlags: null },
        PERMISSIONS.DOCUMENT_CREATE,
      ),
    ).toBe(true);
  });

  it('honors featureFlags.permissions overrides from the DB', () => {
    const custom: Permission = PERMISSIONS.DOCUMENT_CREATE;
    expect(
      planAllows(
        { code: 'free', featureFlags: { permissions: [custom] } },
        custom,
      ),
    ).toBe(true);
    expect(
      planAllows({ code: 'free', featureFlags: { permissions: [] } }, custom),
    ).toBe(false);
  });

  it('persists legacy boolean flags plus a permissions array', () => {
    const flags = tierFeatureFlags(PLAN_BY_CODE.get('free')!) as {
      chat: boolean;
      workflows: boolean;
      inventory: boolean;
      permissions: string[];
    };
    expect(flags.chat).toBe(true);
    expect(flags.workflows).toBe(false);
    expect(flags.inventory).toBe(false);
    expect(flags.permissions.length).toBeGreaterThan(0);
  });

  it('scales limits toward unlimited at Enterprise', () => {
    const enterprise = PLAN_BY_CODE.get('enterprise')!;
    expect(enterprise.maxBranches).toBeNull();
    expect(enterprise.maxStaff).toBeNull();
    expect(enterprise.maxStorageBytes).toBeNull();
  });

  function planRow(code: string) {
    return { code, featureFlags: null };
  }
});
