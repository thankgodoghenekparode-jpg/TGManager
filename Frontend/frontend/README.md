# Zarox Connect UI

React 19 + Vite + TypeScript frontend for the Zarox Connect company operation
management system. Consumes the NestJS backend at
`https://zarox-connect-api.onrender.com` (or a local instance).

## Stack

- React 19, Vite 8, TypeScript
- MUI 6 (+ icons), React Router, Axios, Zustand, TanStack Query, dayjs

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
```

## Connecting to the backend

- **Local backend** (default): Vite proxies `/api` to `http://localhost:4000`.
  Start the backend on port 4000 and log in at `/login`.
- **Deployed backend**: copy `.env.example` to `.env` and set
  `VITE_API_BASE_URL=https://zarox-connect-api.onrender.com/api/v1`.

## Auth & multi-tenancy

- Session auth uses HTTP-only cookies (`zarox_access` / `zarox_refresh`);
  Axios uses `withCredentials` and auto-refreshes on 401.
- Platform admins (`SUPER_ADMIN` / `PLATFORM_SUPPORT`) land in the `/admin`
  area (tenants, plans, users, settings).
- Company users pick a tenant at `/select-company`; the active tenant is sent
  via the `x-tenant-id` header. Permission-based navigation is driven by
  `GET /tenants/current` and `Can`/`useCan`.

## Structure

```
src/
  api/        axios client + typed API modules
  store/      auth + tenant zustand stores
  router/     guards (platform / company / guest / auth)
  components/ layout shells + permission gating
  pages/      auth, platform, company feature pages
```

The org modules currently implemented include Dashboard, Branches, Staff,
Roles (RBAC builder using the `/permissions` catalog), and the platform admin
area. Remaining company modules (departments, groups, schedules, attendance,
chat, documents, memos, inventory, forms, workflows, reports) are wired into
navigation as placeholders ready to be backed by their API endpoints.
