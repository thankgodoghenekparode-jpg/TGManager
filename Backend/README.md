# TGManager API

NestJS, Prisma, and PostgreSQL backend for TGManager.

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
```

For local PostgreSQL:

```bash
npm run db:up
npm run prisma:deploy
npm run prisma:seed
```

Demo seed data is skipped in production unless `SEED_DEMO=true`.

## Run

```bash
npm run start:dev
```

The API listens on the port configured in `.env` and serves routes under
`/api/v1`.

## Verify

```bash
npm run build
npm run test
npx prisma validate
```

## Seed Accounts

Run `npm run prisma:seed` after deploying migrations. Demo accounts use the
password `demo1234`.

### Platform Users

| Email | Platform Role | Access |
| --- | --- | --- |
| `super@tgmanager.com` | `SUPER_ADMIN` | Full platform access and demo org admin |
| `support@tgmanager.com` | `PLATFORM_SUPPORT` | Read-only platform access and demo org staff |

### TGManager Demo Co.

| Email | Name | Company Role |
| --- | --- | --- |
| `admin@tgmanager-demo.com` | Demo Admin | COMPANY_ADMIN |
| `ada.okafor@tgmanager-demo.com` | Ada Okafor | BRANCH_ADMIN |
| `emeka.nwosu@tgmanager-demo.com` | Emeka Nwosu | BRANCH_ADMIN |
| `fatima.ali@tgmanager-demo.com` | Fatima Ali | BRANCH_ADMIN |
| `james.balogun@tgmanager-demo.com` | James Balogun | PROJECT_LEAD |
| `grace.ekpo@tgmanager-demo.com` | Grace Ekpo | DEPARTMENT_MANAGER |
| `chidi.obi@tgmanager-demo.com` | Chidi Obi | SALES_REP |
| `sade.adeyemi@tgmanager-demo.com` | Sade Adeyemi | STAFF |
| `bola.ogundimu@tgmanager-demo.com` | Bola Ogundimu | STAFF |
| `kunle.fashola@tgmanager-demo.com` | Kunle Fashola | SALES_REP |
| `amara.okonkwo@tgmanager-demo.com` | Amara Okonkwo | DEPARTMENT_MANAGER |
| `tunde.ibrahim@tgmanager-demo.com` | Tunde Ibrahim | DEPARTMENT_MANAGER |

### Sunshine Energy Ltd

| Email | Name | Company Role |
| --- | --- | --- |
| `sunshine@demo.com` | Sunshine Admin | COMPANY_ADMIN |

## Migration Baseline

Migrations have been squashed into:

```text
prisma/migrations/20260916000000_baseline/migration.sql
```

For an existing database that already has the prior schema applied, mark the
baseline as applied once:

```bash
npx prisma migrate resolve --applied 20260916000000_baseline
```
