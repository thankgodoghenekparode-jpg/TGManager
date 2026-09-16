# Plan: Restructure, strip deploy config, fix lint & types

## Context
- Folder `zarox-connect-api/` should be flattened into the repo root.
- `render.yaml` and `.github/` must be removed (hosting is now the user's choice).
- All ESLint errors and TypeScript type errors must be fixed.
- User requested: commit and push when done.

## Current state (staged, not committed)
- `git mv` already moved all `zarox-connect-api/*` entries to repo root (src, test, prisma, infra, configs, package files, README).
- `render.yaml` deleted, `.github/workflows/ci.yml` deleted, `zarox-connect-api/.gitignore` deleted.
- Root `.gitignore` not yet merged; `zarox-connect-api/` folder still exists holding a stray `node_modules`.

## Steps
1. Merge the old `zarox-connect-api/.gitignore` rules into root `.gitignore`
   (add: `src/generated/`, `coverage/`, `/storage/`, `.env.local`, `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`; keep existing root entries).
2. Delete the leftover `zarox-connect-api/` directory (currently holds `node_modules`).
3. `npm install` at repo root (use `npm.cmd` — PowerShell blocks bare `npm`).
4. Baseline errors: run `eslint` (no `--fix`) and `tsc --noEmit` / `nest build`.
5. Fix all lint errors (autofix + manual; typescript-eslint recommendedTypeChecked; unused-var; prettier). Tidy lint script glob `"{src,apps,libs,test}/**/*.ts"` → `"{src,test}/**/*.ts"`.
6. Fix all TypeScript type errors until `npm run build` passes clean.
7. Verify: `npm run lint` → 0 errors, `npm run build` → success.
8. Commit (message describing restructure + fixes) and push to `main`.

## Verification commands
- `npx eslint "{src,test}/**/*.ts"`
- `prisma generate` then `npm run build`

## Notes
- e2e tests require Postgres (docker compose) — out of scope for the lint/type pass; can be run on request.
- No remaining config references the old `zarox-connect-api` path (only deleted files did; all paths are relative).