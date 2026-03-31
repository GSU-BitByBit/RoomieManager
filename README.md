# RoomieManager

RoomieManager is a roommate management platform for shared households. The project is designed to support account creation, household groups, role-based membership management, chores, shared bills and payments, balance tracking, and roommate contracts with version history.

The repository is currently backend-first. The NestJS API is implemented across the core product modules, while the frontend application has not been built yet and currently exists as a reference document only.

## Current Status

Status below reflects the latest project docs verified on `2026-03-05`.

| Area | Status | Notes |
| --- | --- | --- |
| Backend core product modules | Strongly complete | Modules 1-8 are complete and validated |
| Frontend application | Not started | `frontend/` currently contains planning and integration reference only |
| Security hardening | In progress | Module 9 is at `30%` |
| Reliability and observability | In progress | Module 10 is at `65%` |
| Testing and quality gates | Nearly complete | Module 11 is at `94%` |

### Phase Snapshot

| Phase | Scope | Status |
| --- | --- | --- |
| Phase 1 | Platform foundation, auth, groups, RBAC | `COMPLETE` |
| Phase 2 | Chores, contracts, API UX improvements | `COMPLETE` |
| Phase 3 | Bills, payments, balances | `COMPLETE` |
| Phase 4 | Security, reliability, operations, final hardening | `PARTIAL` |

## What Is Working Now

The backend currently supports:

- User registration, login, and current-user lookup
- Roommate group creation and join-by-code flows
- Member listing, role updates, and member removal with RBAC protections
- Chore creation, assignment, completion, and filtered listing
- Bill creation, payment recording, and balance settlement views
- Contract draft editing, publishing, and version history
- Standardized response envelopes, pagination, sorting, and OpenAPI-backed API contracts
- Health and readiness probes, structured logging, and CI verification

Current automated verification documented in the repo:

- `54` unit tests passing
- `57` e2e tests passing
- `2` optional live Supabase e2e suites available but skipped by default
- `pnpm verify` passing end-to-end

## Architecture

```text
Frontend (planned, Vite)
    -> HTTP / JSON / Bearer JWT
Backend API (NestJS, /api/v1, port 3000)
    -> Prisma ORM
Supabase Postgres + Supabase Auth
```

Key backend choices:

- `Node.js 20`
- `TypeScript`
- `NestJS 10`
- `Prisma 5`
- `Supabase Postgres`
- `Supabase Auth`
- `Zod` + `class-validator`
- `Jest` + `Supertest`
- `Swagger / OpenAPI`

## Repository Layout

```text
RoomieManager/
|-- backend/                         # NestJS API (primary codebase)
|-- frontend/                        # Frontend reference only for now
|-- Use case diagram and requirements/
|-- AGENTS.md
`-- README.md
```

Useful project documents:

- [`backend/backend_planning.md`](backend/backend_planning.md) - backend roadmap, module status, verification evidence
- [`frontend/frontend_reference.md`](frontend/frontend_reference.md) - frontend integration guide against the live backend
- [`AGENTS.md`](AGENTS.md) - project reference, architecture, workflow, and conventions
- [`Use case diagram and requirements/requirements.txt.txt`](Use%20case%20diagram%20and%20requirements/requirements.txt.txt) - functional and non-functional requirements

## Progress Against Requirements

### Completed product scope

- Accounts and authentication
- Group creation and join codes
- Member management and admin-only role controls
- Chores workflow
- Bills, payments, and balance calculation
- Contract draft and publish workflow
- API documentation and frontend-ready response contracts

### Remaining product and delivery scope

- Frontend implementation
- Join-code expiration enforcement at the application layer
- Secure headers baseline
- Abuse-focused auth and RBAC regression coverage
- Additional frontend-ready finance fixtures
- Remaining production hardening for security and observability

## Current Plan

The next documented milestone is Phase 4 baseline hardening, with frontend support work happening alongside it.

Planned next steps from the repo docs:

1. Enforce `JoinCode.expiresAt` during the join flow and cover it with tests.
2. Add secure HTTP headers using `helmet` with environment-aware configuration.
3. Expand auth and RBAC abuse regression coverage.
4. Add frontend-ready finance seed fixtures for multi-member split and payment scenarios.
5. Keep frontend integration moving against the existing backend contract and OpenAPI output.

Important note: rate limiting is intentionally deferred for now according to the backend planning doc.

## Current Timeline

This repository documents milestone dates for completed work, but it does not currently commit to future calendar ETAs. The timeline below reflects what is verified in the docs today.

| Date | Milestone |
| --- | --- |
| `2026-02-23` | Modules 1-3 were established in the documented project history: platform foundation, auth, groups, health endpoints, and the standard response envelope were all in place |
| `2026-02-24` | Module 4 member-management and RBAC migration deployed and validated |
| `2026-02-25` | Full backend regression audit re-passed end-to-end |
| `2026-03-05` | Modules 5, 6, 7, and 8 documented as complete; backend-wide hardening audit completed; latest verify pipeline passed |
| `Current` | Backend feature delivery is functionally complete through core product scope; Phase 4 hardening remains in progress; frontend app is still pending implementation |
| `Next` | Phase 4 baseline hardening and frontend delivery support are the next planned milestones, but no fixed completion date is documented in the repo |

## Frontend Status

There is no implemented frontend code yet. The `frontend/` directory currently contains a backend integration reference rather than a runnable application.

That means the project is ready for frontend implementation against a live API with:

- stable `/api/v1` versioning
- a standard success/error envelope
- documented pagination and sorting conventions
- generated backend API types
- a documented QA checklist for frontend integration

## Backend API Snapshot

Live endpoint groups documented today:

- Health: `/health/live`, `/health/ready`
- Auth: `/auth/register`, `/auth/login`, `/auth/me`
- Groups and members: `/groups`, `/groups/join`, `/groups/:groupId`, `/groups/:groupId/members`
- Dashboard: `/groups/:groupId/dashboard`
- Chores: `/groups/:groupId/chores`, `/chores/:choreId/assign`, `/chores/:choreId/complete`
- Finance: `/groups/:groupId/bills`, `/groups/:groupId/payments`, `/groups/:groupId/balances`
- Contracts: `/groups/:groupId/contract`, `/groups/:groupId/contract/publish`, `/groups/:groupId/contract/versions`

Base local API URL:

- `http://localhost:3000/api/v1`

Swagger docs:

- `http://localhost:3000/api/docs`

## Local Development

There is no root workspace runner. Work inside `backend/`.

### Backend setup

```bash
cd backend
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm dev
```

### Verification

```bash
cd backend
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm openapi:check
pnpm verify
```

## Recommended Near-Term Project Direction

For the next iteration, the project should focus on two tracks in parallel:

- finish Phase 4 hardening so the backend is safer and easier to operate in production
- begin the frontend implementation using the existing API, OpenAPI contract, and fixture guidance

That is the most direct path from a strong backend foundation to a usable end-to-end product.
