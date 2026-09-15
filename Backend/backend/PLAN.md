# Integration Plan — zarox-energy-oms ↔ zarox_connect

Status: Phase C (frontend rewiring) complete. This document tracks the final
round: biometric clock-in restore, migration/seed rewrite, tenant onboarding
fix, and verification.

## Completed

- **Phase A/B (backend)** — password reset + settings module, geofence
  fallback, swagger $ref pass; old Express backend removed.
- **Phase C (frontend)** — full rewiring onto NestJS `:4000 /api/v1`:
  - axios shim (`{data}` wrap, error normalization, cookie refresh-retry)
  - auth store with flattened memberships (`{id,name,status,plan,roles[]}`)
  - all services/pages adapted to real response shapes (staff, audit,
    workflows, chat, memos, attendance, notifications)
  - admin pages rebuilt against `/staff`, `/company-roles`, `/departments`,
    `/audit`; static permission catalog mirrors backend constants
  - Workflows list/editor rewritten for `/workflows/templates` with embedded
    steps + escalation rules; form-types pages deleted
  - socket hook uses cookie auth + `auth:{tenantId}`, real events only
  - vite proxy → :4000; dead code swept

## In progress

### 1. Restore BiometricClockIn (frontend only)
- Restore component verbatim from git history (fingerprint via WebAuthn +
  camera capture fallback).
- Wire into Dashboard and Attendance clock buttons; confirmation triggers the
  existing geolocation clock-in/out. Photo is client-side verification only —
  the Attendance model stores lat/lng/note only.

### 2. Squash Prisma migrations to a single baseline
- Generate one baseline migration from the current schema; remove legacy
  incremental folders.
- Existing databases: `npx prisma migrate resolve --applied <baseline>` once.

### 3. Rewrite seed.ts — full demo org
- Idempotent, gated by `SEED_DEMO` (default on outside production).
- Plans upsert + demo tenant: COMPANY_ADMIN user, branch, department,
  company roles, staff records, published form with fields, two-step workflow
  with an escalation rule, memo, notification.

### 4. Registration seeds a default branch
- New tenants currently get empty-body 400s from tenant-scoped endpoints until
  a branch exists. Register flow will create a default "Main Branch" so fresh
  tenants work immediately.

### 5. Verification & ship
- Backend tsc/build, frontend build, live smoke of every wired endpoint,
  then commit/push both repos.
