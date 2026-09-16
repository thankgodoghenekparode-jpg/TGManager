# Integration Plan - TGManager

Status: final round implemented and locally verified.

## Completed

- Backend/frontend tree flattened from `Backend/backend` and `Frontend/frontend`
  into `Backend` and `Frontend`.
- Frontend rewired onto the NestJS API surface.
- Biometric clock-in restored as a frontend-only identity gate:
  - WebAuthn fingerprint/passkey verification when available.
  - Camera capture fallback.
  - Existing geolocation clock-in/out payloads remain unchanged.
  - Wired into both Dashboard and Attendance clock actions.
- Prisma migrations squashed into a single baseline:
  - `prisma/migrations/20260916000000_baseline/migration.sql`
  - Existing databases should mark this baseline as applied once:
    `npx prisma migrate resolve --applied 20260916000000_baseline`
- Demo seed is gated by `SEED_DEMO` and skipped in production unless explicitly
  enabled.
- Tenant registration creates a default `Main Branch` so fresh companies can use
  tenant-scoped endpoints immediately.

## Verification

- Backend build: passed.
- Backend unit tests: passed, 5 suites / 26 tests.
- Prisma validate: passed.
- Frontend build: passed.
- Frontend lint: passed with pre-existing warnings in `PermissionGate.tsx` and
  `Forms.tsx`.

## Remaining Manual Smoke

- Start the database stack and API, then run through login, tenant selection,
  dashboard clock-in/out, attendance list, forms, workflows, chat, memos, and
  reports against a seeded database.
