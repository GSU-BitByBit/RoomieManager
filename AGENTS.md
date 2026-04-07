# AGENTS.md — RoomieManager Project Reference

## Project Overview

RoomieManager is a roommate management platform. Users register, form household groups, manage memberships with role-based access control, manage chores, manage shared bills/payments/balances, and maintain group contracts with version history.

The repository is a monorepo with two top-level directories:

- `backend/` — NestJS REST API
- `frontend/` — Vite + React + TypeScript frontend app

There is no root `package.json` or monorepo tooling. Each directory is independent.

## Architecture

```
Frontend (Vite, port 5173)
    ↓ HTTP (JSON, Bearer JWT)
Backend API (NestJS, port 3000, /api/v1)
    ↓ Prisma ORM
Supabase Postgres (cloud)
    ↑
Supabase Auth (JWT identity provider)
```

All business logic lives in the backend. The frontend authenticates via Supabase Auth and sends the JWT to the backend. The backend verifies the token and enforces RBAC.

## Tech Stack

| Layer             | Technology                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Runtime           | Node.js >= 20                                                                                             |
| Language          | TypeScript 5.7                                                                                            |
| Backend framework | NestJS 10                                                                                                 |
| Database          | PostgreSQL via Supabase (cloud)                                                                           |
| ORM / migrations  | Prisma 5                                                                                                  |
| Auth              | Supabase Auth + JWT verification (jose)                                                                   |
| Env validation    | Zod                                                                                                       |
| DTO validation    | class-validator + ValidationPipe                                                                          |
| API docs          | OpenAPI / Swagger (@nestjs/swagger)                                                                       |
| Logging           | Pino (nestjs-pino) with request IDs and redaction                                                         |
| Testing           | Jest + Supertest (54 unit + 57 e2e tests passing; 2 optional live Supabase e2e suites skipped by default) |
| Package manager   | pnpm 9                                                                                                    |
| Linting           | ESLint 9 (flat config)                                                                                    |
| Formatting        | Prettier (single quotes, no trailing commas, 100 print width)                                             |
| CI                | GitHub Actions                                                                                            |

## Repository Layout

```
RoomieManager/
├── AGENTS.md                          ← you are here
├── .github/workflows/backend-ci.yml   ← CI pipeline
├── backend/
│   ├── src/
│   │   ├── main.ts                    ← bootstrap, Swagger, global pipes/filters
│   │   ├── app.module.ts              ← root module (config, logging, Prisma, feature modules)
│   │   ├── config/env.schema.ts       ← Zod env validation
│   │   ├── common/
│   │   │   ├── http/                  ← response interceptor, exception filter, error codes, request-meta
│   │   │   ├── prisma/                ← PrismaService + PrismaModule (global)
│   │   │   └── supabase/             ← shared Supabase URL utility
│   │   └── modules/
│   │       ├── auth/                  ← register, login, /me, JWT guard, Supabase integration
│   │       ├── groups/                ← groups CRUD, join codes, member management, RBAC
│   │       ├── chores/                ← chore CRUD, assign, complete, activity logging
│   │       ├── finance/               ← bills, splits, payments, ledger-backed balances
│   │       ├── contracts/             ← contract draft, publish, version history
│   │       └── health/               ← /live and /ready probes
│   ├── prisma/
│   │   ├── schema.prisma             ← data model (Group, GroupMember, JoinCode, GroupAuditLog, Chore, ChoreActivity, Bill, BillSplit, Payment, LedgerEntry, Contract, ContractVersion)
│   │   ├── seed.ts                   ← dev fixtures
│   │   └── migrations/               ← 7 migrations applied
│   ├── test/                         ← unit specs + e2e specs
│   ├── scripts/                      ← OpenAPI generate/check
│   ├── openapi/openapi.json          ← generated OpenAPI spec (source of truth for contract)
│   ├── backend_planning.md           ← module roadmap, progress tracking, AI module tracking
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   ├── eslint.config.mjs
│   └── .env.example
├── frontend/
│   ├── src/                         ← React pages, components, API client, auth context
│   ├── generated/                   ← generated TypeScript types from backend OpenAPI
│   ├── frontend_reference.md        ← API integration guide for frontend engineers
│   ├── package.json
│   └── vite.config.ts
└── Use case diagram and requirements/
    ├── usecase.puml
    └── requirements.txt.txt
```

## Key Documents

| Document           | Path                             | Purpose                                                                      |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| Backend planning   | `backend/backend_planning.md`    | Module roadmap, phase tracking, AI module status, verification evidence      |
| Frontend reference | `frontend/frontend_reference.md` | Endpoint docs, response contracts, QA checklist, changelog for frontend devs |
| OpenAPI spec       | `backend/openapi/openapi.json`   | Auto-generated; kept in sync via `pnpm openapi:check`                        |
| This file          | `AGENTS.md`                      | Project-wide reference for all contributors                                  |

## Backend Modules and Status

| Module                        | Status        | Key Files                                                                                        |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| 1. Platform Foundation        | COMPLETE      | `main.ts`, `app.module.ts`, `http-exception.filter.ts`, `response.interceptor.ts`                |
| 2. Auth & Identity            | COMPLETE      | `auth.controller.ts`, `auth.service.ts`, `supabase-jwt.service.ts`, `supabase-jwt-auth.guard.ts` |
| 3. Groups & Join Codes        | COMPLETE      | `groups.controller.ts`, `groups.service.ts`, `create-group.dto.ts`, `join-group.dto.ts`          |
| 4. Member Mgmt & RBAC         | COMPLETE      | `groups.controller.ts`, `groups.service.ts`, `update-member-role.dto.ts`                         |
| 5. Chore Management           | COMPLETE      | `chores.controller.ts`, `chores.service.ts`, DTOs, activity logging                              |
| 6. Bills/Payments/Balances    | COMPLETE      | `finance.controller.ts`, `finance.service.ts`, finance DTOs/interfaces                           |
| 7. Contract Management        | COMPLETE      | `contracts.controller.ts`, `contracts.service.ts`, DTOs, version history                         |
| 8. API UX Layer               | COMPLETE      | `openapi.json`, `check-openapi.ts`, `generate-openapi-types.ts`, `check-openapi-types.ts`, pagination/sort DTO + helpers |
| 9. Security Hardening         | PARTIAL (30%) | Exception filter, input validation, Serializable transactions                                    |
| 10. Reliability/Observability | PARTIAL (65%) | Pino logging, health probes, error logging                                                       |
| 11. Testing/Quality           | PARTIAL (94%) | 54 unit + 57 e2e passing (+2 optional live suites), CI pipeline, `pnpm verify`                   |

## API Endpoints (Live)

All endpoints are prefixed with `/api/v1`.

| Method | Path                                    | Auth                        | Status Code | Purpose                               |
| ------ | --------------------------------------- | --------------------------- | ----------- | ------------------------------------- |
| GET    | `/health/live`                          | No                          | 200         | Liveness probe                        |
| GET    | `/health/ready`                         | No                          | 200 / 503   | Readiness probe (DB + migrations)     |
| POST   | `/auth/register`                        | No                          | 201         | Register via Supabase Auth            |
| POST   | `/auth/login`                           | No                          | 200         | Login, returns JWT session            |
| GET    | `/auth/me`                              | Bearer                      | 200         | Current user from token claims        |
| GET    | `/groups`                               | Bearer                      | 200         | List caller's active groups           |
| POST   | `/groups`                               | Bearer                      | 201         | Create group (caller becomes admin)   |
| POST   | `/groups/join`                          | Bearer                      | 200         | Join group by code                    |
| POST   | `/groups/:groupId/join-code/reset`      | Bearer + Admin              | 200         | Rotate join code                      |
| GET    | `/groups/:groupId`                      | Bearer + Member             | 200         | Get group summary                     |
| GET    | `/groups/:groupId/dashboard`            | Bearer + Member             | 200         | Get group dashboard aggregates        |
| GET    | `/groups/:groupId/members`              | Bearer + Member             | 200         | List active members                   |
| POST   | `/groups/:groupId/leave`                | Bearer + Member             | 200         | Leave group                           |
| PATCH  | `/groups/:groupId/members/:userId/role` | Bearer + Admin              | 200         | Update member role                    |
| DELETE | `/groups/:groupId/members/:userId`      | Bearer + Admin              | 200         | Remove member                         |
| POST   | `/groups/:groupId/chores`               | Bearer + Member             | 201         | Create one-off chore occurrence       |
| GET    | `/groups/:groupId/chores`               | Bearer + Member             | 200         | List chore occurrences                |
| GET    | `/groups/:groupId/chores/calendar`      | Bearer + Member             | 200         | Get month/range-ready chore calendar  |
| PATCH  | `/chores/:occurrenceId/assignee`        | Bearer + Admin              | 200         | Reassign chore occurrence             |
| PATCH  | `/chores/:occurrenceId/complete`        | Bearer + Member/Admin rules | 200         | Complete chore occurrence             |
| GET    | `/groups/:groupId/chore-templates`      | Bearer + Member             | 200         | List recurring chore templates        |
| POST   | `/groups/:groupId/chore-templates`      | Bearer + Admin              | 201         | Create recurring chore template       |
| PATCH  | `/groups/:groupId/chore-templates/:templateId` | Bearer + Admin         | 200         | Update recurring chore template       |
| POST   | `/groups/:groupId/chore-templates/:templateId/pause` | Bearer + Admin     | 200         | Pause recurring chore template        |
| POST   | `/groups/:groupId/chore-templates/:templateId/resume` | Bearer + Admin    | 200         | Resume recurring chore template       |
| POST   | `/groups/:groupId/chore-templates/:templateId/archive` | Bearer + Admin  | 200         | Archive recurring chore template      |
| POST   | `/groups/:groupId/bills`                | Bearer + Member             | 201         | Create bill with member splits        |
| GET    | `/groups/:groupId/bills`                | Bearer + Member             | 200         | List group bills                      |
| POST   | `/groups/:groupId/payments`             | Bearer + Member             | 201         | Record payment between members        |
| GET    | `/groups/:groupId/balances`             | Bearer + Member             | 200         | Get net balances and settlements      |
| GET    | `/groups/:groupId/contract`             | Bearer + Member             | 200         | Get contract draft + latest published |
| PUT    | `/groups/:groupId/contract`             | Bearer + Admin              | 200         | Update contract draft                 |
| POST   | `/groups/:groupId/contract/publish`     | Bearer + Admin              | 201         | Publish next contract version         |
| GET    | `/groups/:groupId/contract/versions`    | Bearer + Member             | 200         | List published contract versions      |

Path ID validation:

- `:groupId`, `:occurrenceId`, and `:templateId` accept valid app IDs (`cuid` or UUID).
- `:userId` accepts UUID.
- Invalid IDs return `400 BAD_REQUEST`.

## Response Contract

Every response is wrapped in a standard envelope:

```typescript
// Success
{ success: true, data: T, meta: { requestId: string, timestamp: string } }

// Error
{ success: false, error: { code: string, message: string, details?: unknown }, meta: { requestId: string, timestamp: string } }
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

## Development Workflow

### First-time setup

```bash
cd backend
cp .env.example .env    # fill in your Supabase credentials
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed        # optional: creates dev fixture accounts
```

### Daily development

```bash
pnpm dev                # start with --watch
pnpm test               # unit tests
pnpm test:e2e           # e2e tests
pnpm lint               # ESLint (0 warnings policy)
pnpm verify             # full pipeline: generate → migrate:status → lint → test → test:e2e → build → openapi:check
```

### Adding a new migration

```bash
pnpm prisma migrate dev --name <migration_name>
```

### Updating the OpenAPI spec

```bash
pnpm openapi:generate   # builds then generates openapi/openapi.json
pnpm openapi:check      # verifies spec matches code and enforces semantic core/list/aggregate endpoint assertions
```

## Environment Variables

| Variable                    | Required       | Default                 | Description                                                  |
| --------------------------- | -------------- | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                  | No             | `development`           | `development`, `test`, or `production`                       |
| `PORT`                      | No             | `3000`                  | Backend listen port                                          |
| `API_PREFIX`                | No             | `api/v1`                | Global route prefix                                          |
| `DATABASE_URL`              | Yes            | —                       | Supabase Postgres connection string (session pooler `:5432`) |
| `LOG_LEVEL`                 | No             | `info`                  | Pino log level (`fatal`..`trace`..`silent`)                  |
| `CORS_ORIGINS`              | No             | `http://localhost:5173` | Comma-separated origins, or `*`                              |
| `SUPABASE_URL`              | Yes (for auth) | —                       | Supabase project URL                                         |
| `SUPABASE_ANON_KEY`         | Yes (for auth) | —                       | Supabase anon/public key                                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional       | —                       | Only needed for `prisma:seed` fixture creation               |
| `SUPABASE_JWT_AUDIENCE`     | Optional       | —                       | JWT audience claim; logs warning if unset                    |

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/backend-ci.yml`) runs on pushes/PRs touching `backend/`:

1. Checkout → pnpm 9 → Node 20
2. `pnpm install --frozen-lockfile`
3. `pnpm prisma:generate`
4. Validate `DATABASE_URL` secret exists
5. `pnpm prisma:migrate:deploy`
6. `pnpm verify` (lint → unit tests → e2e tests → build → OpenAPI check)

Required GitHub secrets: `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_AUDIENCE`.

## Coding Conventions

- **Formatting**: Prettier with single quotes, no trailing commas, 100-char line width, semicolons.
- **Linting**: ESLint 9 flat config, zero-warning policy. `@typescript-eslint/no-explicit-any` is off.
- **Imports**: Type-only imports use `import type`. Value imports for NestJS decorators and class-validator.
- **DTOs**: Use `class-validator` decorators. `@Transform` handles normalization (trim, uppercase). Swagger decorators on every field.
- **Services**: Business logic in service classes. Prisma interactive transactions for multi-step operations. Serializable isolation for admin-mutation paths.
- **Controllers**: Thin — delegate to services. Use `ParseAppIdPipe` for app resource IDs (`groupId`, `choreId`) and `ParseUUIDPipe` for external user IDs. Explicit `@HttpCode` on every route.
- **Error handling**: Throw NestJS HTTP exceptions with `{ code: ErrorCode, message: string }`. The global `HttpExceptionFilter` wraps everything into the standard envelope. Never leak internal error details to clients.
- **Tests**: Unit specs in `test/modules/`, e2e specs in `test/`. Mocks use `jest.fn()`. E2e tests verify both response bodies and mock call arguments.
- **Commits**: Keep `pnpm verify` green before committing.

## Important RBAC Rules

- Group creator automatically becomes `ADMIN`.
- Only admins can: reset join codes, update roles, remove members, edit contract drafts, publish contract versions.
- Admins cannot demote/remove themselves via admin endpoints; self-service leave-group is the supported path.
- The last admin cannot be demoted or removed (`409 CONFLICT`).
- Rejoining a group after removal always resets role to `MEMBER`.
- Admin mutations use `Serializable` transaction isolation to prevent race conditions.

## Next Milestone

Module 9 baseline hardening is next (join-code expiration enforcement, secure headers baseline, abuse-focused auth/RBAC regression coverage). Rate limiting remains intentionally deferred for now to keep delivery focused on frontend support and core workflow reliability. See `backend/backend_planning.md` for the full roadmap.
