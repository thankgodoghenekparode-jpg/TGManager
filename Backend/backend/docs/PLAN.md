# Zarox Connect — Development Plan

Implementation roadmap for **zarox-connect-api** (NestJS + Prisma + PostgreSQL).

Status legend: ✅ done · ⬜ pending · 🔶 in progress

| Phase | Title | Status |
| --- | --- | --- |
| 1 | Foundation | ✅ done |
| 2 | Org + RBAC | ✅ done |
| 3 | Schedules + attendance | ✅ done |
| 4 | Content: documents, inventory, memos, forms, reports | ✅ done |
| 5 | Workflows | ✅ done |
| 6 | Chat + audit + notifications | ✅ done |
| 7 | Platform & polish | ✅ done |
| 8 | Document ACL, memo targeting, workflow forms & escalation, integration API | ⬜ |

---

## Current state

- API scaffold: NestJS 11, Prisma 7 (custom client output `src/generated`), Zod validation, Swagger, docker-compose (Postgres), Render-ready.
- Auth: register (user + company + COMPANY_ADMIN role + free-plan trial subscription), login/refresh/logout with HTTP-only cookies, `/auth/me`.
- Multi-tenancy: `x-tenant-id` header + `TenantGuard` scoping, onboarding status flow (`PENDING_BRANCH → BRANCH_CREATED`).
- RBAC: permission catalog, 4 seeded system roles, custom company roles, `RoleAssignment` (branch-scoped), `AbilitiesService`, `AbilitiesGuard`, `@Permissions` decorator.
- Org: branches (geolocation, working hours), departments (managers), groups (members), staff (temp password, roles, group membership, search).
- Content: documents (S3/local storage, versioning, soft delete), inventory (adjustments, low-stock, audit), memos (audience targeting, read tracking), forms (schema-driven fields, submissions), reports (attendance/staff/inventory aggregation + CSV export).
- Workflows: templates with ordered steps, assignee resolution (user / company role / originator's manager), instance state machine (PENDING → APPROVED / REJECTED / CANCELLED), step approvals with notes, pending-approvals inbox.
- Chat: socket.io gateway (`chat:join`/`chat:send`/`chat:read`) with session auth + tenant membership check, per-user/per-conversation rooms, REST conversation/message/history/unread endpoints, read receipts (`chat.create`, `chat.view`).
- Notifications: in-app notifications persisted + pushed live via `notification:new`; fired on workflow pending/approved/rejected, memo publish (audience-targeted), low-stock inventory.
- Audit: fire-and-forget `AuditService.record` + `GET /audit` (filters: entityType/action/userId/date range); wired into workflows (start/step/approve/reject/cancel), memos (publish), staff (create/deactivate), role assign/unassign, inventory adjustments.
- Platform: `platform` module with SUPER_ADMIN / PLATFORM_SUPPORT roles (`PlatformRoleGuard`); plan management (CRUD + deactivate with tenant guard), tenant administration (list/detail/usage, suspend/reactivate with member blocking in `TenantGuard`, onboarding-status override); centralized `PlanLimitsService` (`assertLimit` + usage counters) enforcing branches, staff, documents, chat-history limits with upgrade-hint messages.
- Deploy: `.github/workflows/ci.yml` (lint → unit → migrate → e2e on ephemeral Postgres + Render deploy hook), `render.yaml` blueprint (free plan, attached disk, managed Postgres), security headers, rate limiting middleware, BigInt-safe JSON replacer.
- Verification: `npm run build` ✅, `npm run lint` ✅, unit tests 20/20 ✅, e2e tests 132/132 ✅.

### Known gaps (addressed by Phase 8)

- Documents have no per-user permission grants — `createdByUserId` is stored but never checked for access; permissions are purely RBAC.
- Messages cannot reference documents — `Message` model has no link to `Document`.
- Memo audience targeting supports `all`, `branchIds`, `groupIds` but not individuals or departments.
- Workflows have no link to forms — `FormsModule` and `WorkflowsModule` are completely decoupled.
- Workflow steps have no structured data capture — actors can only attach a free-text `note`.
- No task delegation mechanism — only company admin override exists.
- No escalation, timeout, or auto-action rules on workflow steps — zero time-based or attendance-aware logic.

---

## Phase 1 — Foundation ✅

**Scope:** project scaffold, full schema + migration, config, auth, plans + seed, Swagger, docker, tests, deploy skeleton.

- NestJS scaffold with `src/modules` layout, global prefix `api/v1`.
- Prisma schema: `User`, `Tenant`, `Plan`, `TenantUser`, `TenantSubscription`, auth session tables.
- Config via `@nestjs/config` + Zod env validation (`.env`, `.env.local`, `.env.test`).
- Auth endpoints:
  - `POST /auth/register` — creates user + company + COMPANY_ADMIN role + trial subscription.
  - `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` — HTTP-only cookie sessions with rotation + revocation.
  - `GET /auth/me` — profile + memberships.
- Plans module + seed (FREE / PRO / ENTERPRISE with `maxBranches`, `maxStaff`).
- Swagger setup, `docker-compose.yml` (Postgres), `infra/initdb` for test DB.
- Tests: `auth.e2e-spec.ts`, `tenancy.e2e-spec.ts`.

---

## Phase 2 — Org + RBAC ✅

**Scope:** tenant scoping, onboarding flow, org structure, role-based access control.

- `TenantGuard`: resolves tenant from `x-tenant-id`, verifies membership, attaches `request.tenant`.
- Onboarding status flow on `Tenant.onboardingStatus`.
- Modules (all tenant-scoped):
  - **Branches** — CRUD, geolocation (`latitude/longitude/radiusMeters`), working hours/days, timezone, plan-limit enforcement (`maxBranches`), advances onboarding on first branch.
  - **Departments** — CRUD with branch + manager (`managerUserId`).
  - **Groups** — CRUD with branch + members.
  - **Staff** — CRUD (`staffRecord` + linked `User`), temporary password on create, search/filter, role + group assignment, soft delete (`isActive`).
  - **Company roles** — CRUD, permission set validation, assign/unassign (branch-scoped), immutable system roles, last-COMPANY_ADMIN protection.
- RBAC engine: `PERMISSIONS` catalog, `SYSTEM_ROLE_DEFS` (COMPANY_ADMIN, BRANCH_ADMIN, DEPARTMENT_MANAGER, STAFF), `AbilitiesService` (permission union + `accessibleBranchIds`), `AbilitiesGuard` + `@Permissions`.
- `GET /tenants/current` returns `permissions`, `isCompanyAdmin`, `roles`.
- Tests: `org.e2e-spec.ts`, `rbac.e2e-spec.ts` (plan limits, permission enforcement, role lifecycle).

---

## Phase 3 — Schedules + attendance ✅

**Scope:** schedule engine, clock in/out with window enforcement, status calc, geofence, work-hour restrictions, records/corrections, queries.

- **Schedules**
  - Schema: `Schedule` (staff, branch, date/shift window, recurrence optional).
  - Shift definitions + assignment to staff/group; overlap validation.
- **Attendance**
  - `Attendance` records: clock-in/clock-out timestamps, geolocation snapshot at punch.
  - Endpoints:
    - `POST /attendance/clock-in`, `POST /attendance/clock-out` — requires `attendance.clock_in` / `attendance.clock_out`.
    - Window enforcement: punch only within scheduled window (+ grace), configurable per tenant/branch.
    - Geofence: verify punch coordinates fall within branch `radiusMeters` of branch location.
    - Work-hour restrictions: min/max hours, break rules, overtime flags.
    - Status calculation: present / late / early-leave / absent / overtime — computed from schedule + punches.
  - Records & corrections: `GET /attendance` (filters: branch, staff, date range, status), `PATCH /attendance/:id` (correction, requires `attendance.manage`), audit of corrections.
- Permission keys: `attendance.clock_in`, `attendance.clock_out`, `attendance.view`, `attendance.manage`; `schedule.manage`.
- Tests: schedule CRUD/assignment, clock in/out happy path + window/geofence/work-hour denials, status calc, corrections.

---

## Phase 4 — Content ✅

**Scope:** documents + S3, inventory, memos, forms, reports.

- **Documents** — upload/download (S3 presigned or local streaming), versioning, soft delete, plan storage limits, permissions (`document.*`).
- **Inventory** — items, stock levels, adjustments (with audit log), low-stock flags; permissions (`inventory.view`, `inventory.manage`).
- **Memos** — broadcast memos with branch/group audience targeting, draft + publish, read tracking; permissions (`memo.view`, `memo.create`, `memo.manage`).
- **Forms** — schema-driven templates (TEXT/NUMBER/DATE/SELECT/RADIO/CHECKBOX), validation on submit, publish flow, submission visibility scoping; permissions (`form.view`, `form.create`, `form.manage`, `form.submit`).
- **Reports** — aggregation queries (attendance, staff, inventory) + CSV export; permission (`report.view`).
- Tests per domain: CRUD, permissions, ownership/scoping, storage flows (`content.e2e-spec.ts`, 20 cases).

---

## Phase 5 — Workflows ✅

**Scope:** workflow templates, steps, instances, approvals.

- **Templates** — CRUD with ordered steps; branch-scoped or company-wide; `isActive` toggle; version counter.
- **Steps** — ordered steps with action (APPROVE/REJECT/ACKNOWLEDGE/PROVIDE_INFO), assignee rule (USER / COMPANY_ROLE / ORIGINATOR_MANAGER), `isFinal` flag; duplicate-order and rule validation.
- **Instances** — started from an active template by anyone with `workflow.submit`; assignees resolved at start (department manager of initiator, members of a company role in the instance branch, or explicit user); state machine `PENDING → APPROVED / REJECTED / CANCELLED`; `payload` JSON.
- **Approvals** — step-level approve/reject (assigned user or company admin) with optional notes, `actionedBy`/`actionedAt` capture, `currentStepId` advancement; `GET /workflows/approvals` pending inbox; initiator/admin cancel.
- Permission keys: `workflow.view`, `workflow.create`, `workflow.submit`, `workflow.approve`.
- Tests: template CRUD + validation, assignee resolution, instance lifecycle (approve/reject/cancel), permission enforcement (`workflows.e2e-spec.ts`, 13 cases).

---

## Phase 6 — Chat + audit + notifications ✅

**Scope:** real-time chat, read receipts, audit wiring, notifications.

- **Chat**
  - Socket.io gateway with session auth (JWT via `auth.token` or `zarox_access` cookie) + tenant-membership verification; joins `user:{id}` and `tenant:{id}` rooms; rejects and disconnects unauthorized clients.
  - Events: `chat:join` / `chat:send` / `chat:read` with ack responses; broadcasts `chat:message`, `chat:read`, `chat:conversation`.
  - REST: `POST /chat/conversations` (DIRECT find-or-create, GROUP with members), `GET /chat/conversations` (lastMessage + unreadCount), `GET /chat/conversations/:id`, `GET /chat/unread-count`, `GET /chat/conversations/:id/messages` (cursor pagination + `readByMe`), `POST /chat/conversations/:id/messages`, `POST /chat/conversations/:id/read`.
  - Permission keys: `chat.create`, `chat.view` (STAFF+); non-members forbidden.
- **Audit**
  - `AuditLog` records via fire-and-forget `AuditService.record` (workflow start/step-approve/instance-approve/reject/cancel, memo publish, staff create/deactivate, role assign/unassign, inventory adjustments).
  - `GET /audit` (requires `audit.view`, added to BRANCH_ADMIN) with filters: `entityType`, `action`, `userId`, `from`, `to`, `limit`.
- **Notifications**
  - `Notification` model (tenant-scoped, per-user, `readAt`); in-app list/unread-count/read/read-all endpoints.
  - Live delivery via `notification:new` to the user's socket room.
  - Events wired: workflow pending/approved/rejected, memo publish (audience-targeted), inventory low-stock (users with `inventory.manage`).
- Tests: gateway connect/auth-reject, join/read-receipt round-trips, REST chat + unread flow, workflow/memo-triggered notifications, audit entries + filters + 403 for staff (`phase6.e2e-spec.ts`, 24 cases).

---

## Phase 7 — Platform & polish ✅

**Scope:** platform module, plan-limit enforcement, CI, deploy hardening.

- **Platform module** (`platform.controller`/`platform.service`):
  - Roles: `SUPER_ADMIN` (full) and `PLATFORM_SUPPORT` (read-only, tenant override) via `PlatformRoleGuard` + `@PlatformRoles`; blocked from a regular tenant context.
  - Plans: `POST/PATCH/DELETE /platform/plans`, `GET /platform/plans`; duplicate code → 409; plan with active tenants cannot be deactivated; plan limits editable.
  - Tenants: `GET /platform/tenants` (list + counts), `GET /platform/tenants/:id` (detail), `GET /platform/tenants/:id/usage`, `POST /platform/tenants/:id/suspend` / `activate`, `POST /platform/tenants/:id/onboarding-status`, `PUT /platform/tenants/:id/plan` (plan switch).
  - Suspension enforced globally: `TenantGuard` rejects requests from members of a SUSPENDED tenant.
- **Plan-limit enforcement** — centralized `PlanLimitsService.assertLimit` with usage counters (branches, staff, documents, chat history) and `UpgradeError` (403) with the tenant's plan name and upgrade hint; storage/chat limits enforced via `maxStorageBytes` (BigInt, serialized as string) and `chatHistoryLimit`.
- **CI (GitHub Actions)** — `.github/workflows/ci.yml`: `lint → prisma generate → build → unit → migrate → e2e` on Ubuntu with ephemeral Postgres 16 service, Node 22 + npm cache; on `main` triggers a Render deploy hook.
- **Deploy hardening** — `render.yaml` blueprint (web service + managed Postgres + 1 GB disk for local storage), `GET /health` health-check path, env-gated security headers (helmet + HSTS), in-memory rate limiting, `AuditService` (PII-safe, fire-and-forget), BigInt-safe JSON replacer, secrets never logged.
- Tests: `platform.e2e-spec.ts` (20 cases: access control, plan CRUD/limits, tenant admin, suspension, enforcement matrix), `plan-limits.service.spec.ts` unit tests; CI validated locally against `zarox_connect_test`.

---

## Phase 8 — Document ACL, memo targeting, workflow forms & escalation, integration API ⬜

**Scope:** document-level permission grants, chat document references, memo audience expansion, workflow template-level forms, per-step data capture, task delegation, workflow escalation/timeout rules, and a bidirectional integration API for external systems.

### 8a — Document ACL + Chat document references

- **DocumentGrant model** — `id, documentId, userId, permission (READ|WRITE), grantedByUserId, createdAt`; unique constraint on `[documentId, userId]`.
- **Access rules:**
  - Creator/owner (`createdByUserId`) always has full control (no grant needed).
  - Non-owners: check `DocumentGrant` for the user's permission level.
  - Users with `document.update` RBAC permission can still edit any doc in their accessible branches (existing behavior preserved).
  - `list` returns docs where the user has RBAC permission, is the owner, or holds a grant.
- **New endpoints:**
  - `POST /documents/:id/grants` — creator/owner grants READ or WRITE to a user.
  - `DELETE /documents/:id/grants/:userId` — revoke a grant.
  - `GET /documents/:id/grants` — list grants for a document.
- **Chat document references:**
  - Add optional `documentIds: z.array(z.string()).max(5)` to `sendMessageSchema` and `socketSendMessageSchema`.
  - Validate each document exists, belongs to the same tenant, and the sender has access.
  - `Message` model: add optional `documentId String?` with `@relation`; create records for linked docs.
  - Response includes linked document metadata (title, mimeType, sizeBytes).

### 8b — Memo audience expansion

- **New audience targets:**
  - `userIds: string[]` — target specific individuals by user ID.
  - `departmentIds: string[]` — target all active staff in the listed departments (resolved via `StaffRecord.departmentId`).
- **Resolution logic update** in `audienceMemberIds`: add department member query and individual user lookup alongside existing `branchIds` and `groupIds`.
- **Visibility update** in `isVisible`: add checks for `userIds.includes(currentUserId)` and department overlap with user's staff records.

### 8c — Workflow forms + step data + delegation

- **Template-level form:** `WorkflowTemplate` gains optional `formId String?` with `@relation Form`. When set, the template's form defines the structured data schema for the workflow.
- **Per-step data capture:**
  - `WorkflowStepInstance` gains `data Json @default("{}")` for structured step-level responses.
  - `WorkflowActionBodyDto` gains optional `formData z.record(z.string(), z.unknown())` — actors submit structured data when acting.
  - When the template has a form, `formData` is validated against the form's field definitions before persisting to `WorkflowStepInstance.data`.
- **Task delegation (final):**
  - `WorkflowStepInstance` gains `delegatedToUserId String?` and `originalAssignedToUserId String?`.
  - New endpoint: `POST /workflows/instances/:id/delegate` with `DelegateStepDto { delegatedToUserId: string, note?: string }`.
  - Only the current assignee or company admin can delegate.
  - Delegation is final — the original assignee cannot reclaim the task.
  - `assignedToUserId` is updated to the delegatee; `originalAssignedToUserId` records the original assignee.
  - Audit log entry + notification to the delegate.
- **Workflow escalation & timeout rules:**
  - New Prisma model `WorkflowEscalation` — `id, stepId, type (AUTO_ACTION|NOTIFY|REASSIGN), trigger (NO_RESPONSE|ABSENT|TIMEOUT), timeoutMinutes, action (APPROVE|REJECT|SKIP|NOTIFY_ADMIN), targetUserId?`.
  - Each `WorkflowStep` can have multiple escalation rules, ordered by priority.
  - `WorkflowStep` gains `isRequired Boolean @default(true)` — when true, the step cannot be skipped; when false, the step can be auto-completed by escalation.
  - `WorkflowStep` gains `dueInMinutes Int?` — optional SLA deadline for the step (used for escalation trigger calculations).
  - Escalation types:
    - `AUTO_ACTION` — automatically approve/reject/skip the step after the trigger condition is met (only allowed when `isRequired: false` for APPROVE/SKIP).
    - `NOTIFY` — send notification to `targetUserId` (or all company admins if unset) when the trigger fires.
    - `REASSIGN` — reassign the step to `targetUserId` when the trigger fires.
  - Escalation triggers:
    - `NO_RESPONSE` — step has not been actioned within `timeoutMinutes` of assignment.
    - `ABSENT` — assigned user's `isActive` is false (checked periodically or at evaluation time).
    - `TIMEOUT` — step has been in PENDING state for longer than `dueInMinutes` (if set) or `timeoutMinutes`.
  - Background evaluation: `EscalationService.evaluate()` runs on a configurable interval (default every 5 minutes), checks all PENDING step instances against their template's escalation rules, and fires matching actions.
  - DTO for template creation/update: `escalationRules` array on step definitions.

### 8d — Integration API (bidirectional)

- **New Prisma models:**
  - `IntegrationApiKey` — `id, tenantId, name, keyPrefix, keyHash, permissions (String[]), isActive, createdAt, lastUsedAt`.
  - `IntegrationWebhook` — `id, tenantId, url, secret, events (String[]), isActive, createdAt`.
  - `IntegrationDelivery` — `id, webhookId, eventType, payload (Json), status (PENDING|DELIVERED|FAILED), attempts, lastError, createdAt, deliveredAt`.
- **IntegrationApiKeyGuard** — validates `X-Api-Key` header, bcrypt-compares against stored hash, loads tenant context. Separate from JWT auth.
- **New endpoints (API key auth):**
  - `POST /integrations/workflows/start` — start a workflow instance with external payload.
  - `POST /integrations/workflows/instances/:id/step-data` — submit structured data for a workflow step.
  - `GET /integrations/workflows/instances/:id` — poll workflow instance status.
- **Webhook management (JWT auth):**
  - `POST /integrations/webhooks` — register a webhook URL + events + HMAC secret.
  - `GET /integrations/webhooks` — list webhooks.
  - `DELETE /integrations/webhooks/:id` — remove a webhook.
- **API key management (JWT auth):**
  - `POST /integrations/api-keys` — generate a new API key (returns plaintext + key ID once).
  - `GET /integrations/api-keys` — list API keys (hashed, no plaintext).
  - `DELETE /integrations/api-keys/:id` — revoke an API key.
- **Webhook delivery:**
  - When a workflow step completes (approve/reject/delegate) or instance finishes, enqueue an `IntegrationDelivery` record.
  - Fire-and-forget delivery: POST to webhook URL with HMAC-signed payload (`X-Hub-Signature-256`).
  - Retry on failure: up to 3 attempts with exponential backoff (1min, 5min, 30min).
  - Events: `workflow.instance.started`, `workflow.step.completed`, `workflow.step.rejected`, `workflow.step.delegated`, `workflow.instance.approved`, `workflow.instance.rejected`.

---

## Cross-cutting conventions

- Every new module: `Controller + Service + Module + Zod DTO + Prisma model + migration + e2e tests`.
- All org endpoints use `TenantGuard` + `AbilitiesGuard` + `@Permissions`.
- All queries scoped by `tenantId`; branch-scoped access enforced via `AbilitiesContext.accessibleBranchIds`.
- Run before finishing any phase:
  - `npm run build`
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
