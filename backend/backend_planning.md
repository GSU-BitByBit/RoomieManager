# Backend Planning

## Goal

Build a robust, secure, and scalable backend that fully supports frontend workflows for:

- User accounts
- Roommate groups and memberships
- Chores
- Bills, payments, and balances
- Roommate contract management

This plan splits all backend work into modules, then assigns modules to delivery phases.

## Guiding Principles

- API-first design with stable contracts for frontend consumption.
- Strict authentication and role-based authorization (RBAC).
- Transaction-safe financial logic for bills/payments/balances.
- Clear error handling and predictable response shapes.
- High test coverage for business-critical flows.

## Technology Decisions

### Is Supabase a good choice?

Yes. Supabase is a strong fit for this project if we use it as:

- Managed Postgres database
- Auth provider (JWT identity)
- Optional Realtime channel for live UI updates

Architecture decision:

- Use a 3-tier model: Frontend -> Backend API -> Supabase Postgres/Auth.
- Keep business rules (especially bills/payments/balances and RBAC) in backend services, not directly in the frontend.

### Selected Backend Stack (Current)

- Runtime and language: `Node.js 20` + `TypeScript`
- API framework: `NestJS`
- Database: `Supabase Postgres` (cloud-first; no local Docker DB workflow in repo)
- ORM and migrations: `Prisma`
- Auth: `Supabase Auth` token verification in backend middleware
- Validation: `zod` for env config + `class-validator`/`ValidationPipe` for request DTOs
- API contract: `OpenAPI/Swagger`
- Testing: `Jest` + `Supertest`
- Observability: structured logs + request IDs + health/readiness endpoints

## Technology Rollout by Phase

### Phase 1 Technology Rollout (Modules 1-4)

- Set up `Node.js + TypeScript`, project skeleton, config, logging, and global error handling.
- Connect backend to `Supabase Postgres` via `Prisma`; create baseline schema and migrations.
- Integrate `Supabase Auth` verification for protected routes.
- Implement RBAC middleware for group/member/admin roles.
- Publish baseline `OpenAPI` spec for auth/group/member endpoints.

### Phase 2 Technology Rollout (Modules 5, 7, and 8)

- Reuse Phase 1 stack to add chores and contract domain modules.
- Add pagination/filtering standards and consistent validation/error objects.
- Add optional `Supabase Realtime` events for chore status and contract publish updates.

### Phase 3 Technology Rollout (Module 6)

- Implement financial engine on `Supabase Postgres` with transactional `Prisma` operations.
- Use ledger-style tables for auditable balance computation.
- Add idempotency key handling for payment recording endpoints.
- Extend `OpenAPI` with bill/payment/balance contracts and examples.

### Phase 4 Technology Rollout (Modules 9-11)

- Security hardening: rate limits, secure headers, stricter input validation, auth abuse controls.
- Reliability and operations: tracing IDs, metrics, alert-friendly logs, readiness checks.
- CI quality gates: tests, linting, migration checks, and contract test enforcement.

## Module-to-Technology Mapping

- Module 1 (Platform Foundation): `Node.js`, `TypeScript`, `NestJS`, configuration, logging, health endpoints.
- Module 2 (Authentication and Identity): `Supabase Auth` + backend token verification + auth middleware.
- Module 3 (Groups and Join Codes): `Prisma` models on `Supabase Postgres`, join code generation rules.
- Module 4 (Member Management and RBAC): centralized authorization middleware and audit logging.
- Module 5 (Chore Management): REST endpoints with validation; optional realtime updates.
- Module 6 (Bills/Payments/Balances): transactional `Prisma` service layer + ledger tables + idempotency keys.
- Module 7 (Contract Management): versioned contract tables and admin-only publish workflow.
- Module 8 (API UX Layer): `OpenAPI`, response contracts, pagination/filter standards, contract tests.
- Module 9 (Security): rate limiting, sanitization, secure headers, RBAC abuse testing.
- Module 10 (Reliability/Operations): structured logs, metrics, tracing IDs, health/readiness checks.
- Module 11 (Testing/Quality): `Jest`, `Supertest`, e2e workflows, CI pipeline gates.

## Current Progress (As of 2026-03-05)

### Completed

- Module 1 (Platform Foundation) is implemented and validated.
- Module 2 (Authentication and Identity) is implemented and validated:
  - `POST /api/v1/auth/register` (returns `201`)
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Module 3 (Groups and Join Codes) is implemented and validated:
  - `POST /api/v1/groups` (returns `201`)
  - `POST /api/v1/groups/join`
  - `POST /api/v1/groups/:groupId/join-code/reset`
  - `GET /api/v1/groups/:groupId`
- Prisma schema and migration for groups are applied on Supabase:
  - `Group`
  - `GroupMember`
  - `JoinCode` (includes `expiresAt` column for future expiration support)
- Backend is running against Supabase cloud Postgres with successful Prisma migration/seed.
- Unified success/error response envelope is live.
- Health endpoints are implemented and verified:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/ready`
- CI workflow exists and expects Supabase secrets (instead of local Postgres service).
- `pnpm verify` quality gate is passing (lint, unit, e2e, build, OpenAPI drift check).
- Post-audit hardening fixes are applied:
  - Group names are trimmed before validation so whitespace-only names are rejected.
  - Sensitive request data is redacted in logs (`authorization`, API keys, password fields, cookies).
- Extended live Supabase-backed smoke audit passed for health, auth, and groups edge cases.
- Module 4 (Member Management and RBAC) is implemented and validated:
  - `GET /api/v1/groups/:groupId/members`
  - `PATCH /api/v1/groups/:groupId/members/:userId/role`
  - `DELETE /api/v1/groups/:groupId/members/:userId`
- Module 4 migration `0003_module4_member_management_rbac` is deployed on Supabase.
- Module 4 RBAC safeguards are live:
  - admin-only role/update/remove actions
  - last-admin demotion/removal protection
  - self-demotion and self-removal prevention
  - audit-log writes for role updates/removals
- Module 5 (Chore Management) is implemented and validated:
  - `POST /api/v1/groups/:groupId/chores` (returns `201`)
  - `GET /api/v1/groups/:groupId/chores`
  - `PATCH /api/v1/chores/:occurrenceId/assignee`
  - `PATCH /api/v1/chores/:occurrenceId/complete`
- Module 7 (Contract Management) is implemented and validated:
  - `GET /api/v1/groups/:groupId/contract`
  - `PUT /api/v1/groups/:groupId/contract`
  - `POST /api/v1/groups/:groupId/contract/publish` (returns `201`)
  - `GET /api/v1/groups/:groupId/contract/versions`
- Module 6 (Bills, Splits, Payments, and Balances) is implemented and validated:
  - `POST /api/v1/groups/:groupId/bills` (returns `201`)
  - `GET /api/v1/groups/:groupId/bills`
  - `POST /api/v1/groups/:groupId/payments` (returns `201`)
  - `GET /api/v1/groups/:groupId/balances`
- Migrations `20260305192502_0004_hardening_indexes_join_code_expiry`, `20260305193953_0005_module5_chores`, `20260305195941_0006_module7_contracts`, and `20260305213000_0007_module6_finance` are deployed on Supabase.
- Full backend regression audit passed on `2026-02-24` (EST) / `2026-02-25` (UTC):
  - dependency integrity: `pnpm install --frozen-lockfile`
  - quality gate: `pnpm verify`
  - coverage: `pnpm test:cov`
  - production boot/readiness: `pnpm start:prod` + health checks
  - live Supabase flow + DB sanity validation for Module 4 paths
- Backend-wide security and quality hardening audit completed on `2026-03-05`:
  - **Security: Privilege escalation fix** -- Rejoining a group via join code now resets role to `MEMBER` (previously preserved old role, allowing removed admins to regain admin).
  - **Security: Race condition fix** -- `updateMemberRole` and `removeMember` now use `Serializable` transaction isolation to prevent concurrent demotions leaving a group with zero admins.
  - **Security: Info leakage fix** -- `HttpExceptionFilter` no longer sends raw `Error.message`, Prisma column names, or Prisma error codes to clients. Supabase internal error fields (`error`, `error_code`, `rawCode`) are no longer forwarded in auth error responses. Health readiness probe only returns check statuses, not raw DB error messages.
  - **Security: Input validation** -- `@MaxLength(128)` added to password fields in `RegisterDto` and `LoginDto`. IDs now use strict param validation: `ParseAppIdPipe` for app resource IDs (`groupId`, `choreId`) and `ParseUUIDPipe` for `userId`. Malformed IDs now return clean `400` instead of hitting the database.
  - **Security: Auth semantics** -- Supabase 403 (Forbidden) now correctly maps to `ForbiddenException` instead of being conflated with 401 (Unauthorized). Audience validation logs a warning when `SUPABASE_JWT_AUDIENCE` is unset.
  - **Security: JWT handling** -- `aud` claim is now correctly extracted when it is an array (previously silently dropped).
  - **Reliability: Error logging** -- `HttpExceptionFilter` now logs all 500-class errors server-side. `HealthService` logs database and migration check failures.
  - **Reliability: safeJson fix** -- `safeJson` in `AuthService` now throws `ServiceUnavailableException` on successful HTTP responses with non-JSON bodies instead of silently returning `{}`.
  - **Code quality** -- Extracted shared `resolveSupabaseUrl` utility (eliminates duplication between `AuthService` and `SupabaseJwtService`). Removed dead group-existence check from `assertAdminMembership`. Hardened `isAlreadyWrapped` duck-typing check in `ResponseInterceptor`. Fixed empty-string array edge case in `request-meta.ts`. Deleted dead `.eslintrc.cjs` file and fixed hardcoded absolute path in `eslint.config.mjs`.
  - **REST conventions** -- `POST /auth/register` and `POST /groups` now return `201 Created` instead of `200`.
  - **Schema** -- Added indexes on `Group.createdBy`, `GroupAuditLog.targetUserId`, `GroupAuditLog.createdAt`. Added `expiresAt` column to `JoinCode` model. Migration `20260305192502_0004_hardening_indexes_join_code_expiry` deployed on Supabase.
  - **CORS** -- Default `CORS_ORIGINS` changed from `http://localhost:3000` (port collision with API) to `http://localhost:5173`.
  - **Tests** -- All e2e tests now verify mock call arguments. Stronger assertions for join code format, health readiness body, env schema validation, and response-envelope contract shape across key modules. New test cases for guard verification failure, ID-format rejection, pagination/sort validation, and negative env validation paths. Total: 54 unit tests + 57 e2e tests passing (plus 2 optional live Supabase e2e suites skipped by default).
  - `pnpm verify` passes end-to-end (prisma:generate, prisma:migrate:status, lint, test, test:e2e, build, openapi:check).
- Module 8 (API UX Layer) is now complete:
  - Standard list query params are enforced on all list routes: `page`, `pageSize`, `sortBy`, `sortOrder`.
  - Standard pagination response block is enforced: `{ page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage }`.
  - Dashboard aggregation endpoint is available for frontend landing views: `GET /api/v1/groups/:groupId/dashboard`.
  - OpenAPI now includes concrete success envelope examples across auth/group/member/chores/contracts/bills/payments/balances and readiness flows.
  - `openapi:check` enforces semantic contract assertions for core, list, and aggregate routes, including required success-envelope examples and required data keys for core endpoints.
  - Frontend-typed API contracts are generated and drift-checked (`frontend/generated/backend-api.types.ts`, `openapi:types:generate`, `openapi:types:check`).
  - Added/maintained e2e contract coverage for response envelopes and invalid pagination/sort input paths.
- Optional live Supabase deep journey suite added (`test/live-user-journey.e2e-spec.ts`) to exercise a production-like multi-module flow when live fixtures are available.

### In Progress

- Module 9 hardening remains in progress; rate limiting is still intentionally deferred to keep delivery focused on frontend support and workflow stability.
- Join-code expiration enforcement is pending at application layer (`JoinCode.expiresAt` exists in schema but is not enforced yet).
- Frontend-ready finance seed fixtures (multi-member split/payment scenarios) are still pending.

### Verification Evidence

- Code paths:
  - `src/main.ts`
  - `src/app.module.ts`
  - `src/common/http/response.interceptor.ts`
  - `src/common/http/http-exception.filter.ts`
  - `src/common/http/request-meta.ts`
  - `src/common/http/dto/pagination-query.dto.ts`
  - `src/common/http/pagination.ts`
  - `src/common/supabase/supabase-url.util.ts`
  - `src/modules/auth/auth.controller.ts`
  - `src/modules/auth/auth.service.ts`
  - `src/modules/auth/guards/supabase-jwt-auth.guard.ts`
  - `src/modules/auth/supabase-jwt.service.ts`
  - `src/modules/auth/dto/register.dto.ts`
  - `src/modules/auth/dto/login.dto.ts`
  - `src/modules/health/health.controller.ts`
  - `src/modules/health/health.service.ts`
  - `src/config/env.schema.ts`
  - `prisma/schema.prisma`
  - `prisma/migrations/0001_init_platform/migration.sql`
  - `prisma/migrations/0002_module3_groups_join_codes/migration.sql`
  - `prisma/migrations/0003_module4_member_management_rbac/migration.sql`
  - `prisma/migrations/20260305192502_0004_hardening_indexes_join_code_expiry/migration.sql`
  - `prisma/migrations/20260305193953_0005_module5_chores/migration.sql`
  - `prisma/migrations/20260305195941_0006_module7_contracts/migration.sql`
  - `prisma/migrations/20260305213000_0007_module6_finance/migration.sql`
  - `src/modules/groups/groups.controller.ts`
  - `src/modules/groups/groups.service.ts`
  - `src/modules/groups/dto/update-member-role.dto.ts`
  - `src/modules/groups/dto/create-group.dto.ts`
  - `src/modules/groups/dto/list-group-members.query.ts`
  - `src/modules/groups/dto/list-user-groups.query.ts`
  - `src/modules/chores/chores.controller.ts`
  - `src/modules/chores/chores.service.ts`
  - `src/modules/chores/dto/list-chores.query.ts`
  - `src/modules/contracts/contracts.controller.ts`
  - `src/modules/contracts/contracts.service.ts`
  - `src/modules/contracts/dto/list-contract-versions.query.ts`
  - `src/modules/finance/finance.controller.ts`
  - `src/modules/finance/finance.service.ts`
  - `src/modules/finance/dto/list-bills.query.ts`
  - `src/modules/finance/dto/create-bill.dto.ts`
  - `src/modules/finance/dto/create-payment.dto.ts`
  - `src/modules/finance/interfaces/finance-response.interface.ts`
  - `test/auth.e2e-spec.ts`
  - `test/groups.e2e-spec.ts`
  - `test/health.e2e-spec.ts`
  - `test/chores.e2e-spec.ts`
  - `test/contracts.e2e-spec.ts`
  - `test/finance.e2e-spec.ts`
  - `test/live-supabase-smoke.e2e-spec.ts`
  - `test/live-user-journey.e2e-spec.ts`
  - `test/modules/groups/groups.service.spec.ts`
  - `test/modules/auth/supabase-jwt-auth.guard.spec.ts`
  - `test/modules/health/health.service.spec.ts`
  - `test/modules/chores/chores.service.spec.ts`
  - `test/modules/contracts/contracts.service.spec.ts`
  - `test/modules/finance/finance.service.spec.ts`
  - `test/config/env.schema.spec.ts`
  - `openapi/openapi.json`
  - `eslint.config.mjs`
  - `.github/workflows/backend-ci.yml`
- Automated checks (last pass on `2026-03-05`):
  - `pnpm prisma:generate`
  - `pnpm prisma:migrate:status` (7 migrations, schema up to date)
  - `pnpm lint` (0 warnings)
  - `pnpm test` (54 unit tests)
  - `pnpm test:e2e` (57 e2e tests passed, 2 optional live suites skipped by default)
  - `pnpm build`
  - `pnpm openapi:check`
  - Full `pnpm verify` pipeline passed end-to-end.
- Test scope note:
  - Jest `*.e2e-spec.ts` suites validate app wiring/contract shape with provider overrides and verify mock call arguments.
  - Live Supabase integration suites are available in `test/live-supabase-smoke.e2e-spec.ts` and `test/live-user-journey.e2e-spec.ts`; both run only when `ENABLE_LIVE_SUPABASE_TESTS=true`.
  - `live-user-journey` is intentionally non-blocking when no confirmed fixture login is available in the target Supabase project.
- Live smoke checks (last pass on `2026-03-05`):
  - Register/login/token validation paths against Supabase Auth.
  - Group create/join/reset/get paths with admin/member/unauthorized/invalid-code edge cases.
  - Module 4 member list/role update/remove flows, including last-admin and self-removal edge cases.
  - Module 6 finance flows: bill create/list, payment idempotency replay, and deterministic balance settlement verification.
  - Request ID propagation and wrapped unknown-route behavior.
  - Production-mode runtime boot and readiness check (`NODE_ENV=production` + `start:prod`) passed.
  - DB sanity checks passed for migration health, membership state transitions, and audit-log writes.

### Environment and Infra Notes

- Use Supabase session pooler URL (`aws-1-<region>.pooler.supabase.com:5432`) for Prisma migrate and runtime in IPv4-only environments.
- Use username format `postgres.<project_ref>` for Supabase pooler connections.
- Avoid transaction pooler (`:6543`) for Prisma migrate commands.
- Required CI secrets:
  - `SUPABASE_DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_JWT_AUDIENCE`

## Future Delivery Plan

### Next Milestone (Phase 4 kickoff)

1. Module 9 baseline hardening (rate limiting still deferred)

- Enforce `JoinCode.expiresAt` during join flow and cover with unit/e2e tests.
- Add secure HTTP headers baseline (`helmet`) with environment-aware configuration.
- Add abuse-focused regression tests for auth/RBAC edge paths.

### Near-Term Follow-up (Frontend + QA support)

1. Add frontend-ready seed fixtures for finance scenarios (multi-member splits, partial payments, reversals).
2. Add optional dashboard aggregation endpoints that reduce frontend roundtrips for high-traffic views.
3. Add a CI-safe contract test that compares selected live responses against OpenAPI envelope expectations.

### Risks to Track in Upcoming Work

- Auth drift between Supabase claims and backend role model.
- ~~Join code race conditions under concurrent joins.~~ (mitigated: Serializable isolation on admin-mutation transactions)
- ~~RBAC gaps from inconsistent group-scoped authorization checks.~~ (mitigated: self-demotion guard, rejoin role reset, strict ID param validation with `ParseAppIdPipe`/`ParseUUIDPipe`)
- Contract drift if endpoint DTOs and Swagger schema diverge.
- Join code expiration enforcement (schema column exists but application-level enforcement not yet implemented).

## AI Module Tracking

Purpose:

- Give human and AI contributors one canonical place to check backend module completion.
- Reduce ambiguity before planning or implementing the next change.

Last verified:

- `2026-03-05`

Status legend:

- `NOT_STARTED`: no meaningful implementation for this module.
- `PARTIAL`: some foundations exist, but exit criteria are not met.
- `COMPLETE`: scope and exit criteria for the module are met.
- `BLOCKED`: work is paused due to an external dependency or decision.

Update rules (for AI agents):

- Update this section first when module status changes.
- Keep `Last verified` current with an absolute date (`YYYY-MM-DD`).
- Only set `COMPLETE` when implementation + tests cover the module's core flows.
- Add at least one concrete evidence path for every `PARTIAL` or `COMPLETE` module.

### Human-Readable Snapshot

| Module | Name                                       | Phase     | Status   | Progress | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------ | --------- | -------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Platform Foundation                        | Phase 1   | COMPLETE |     100% | `src/main.ts`, `src/app.module.ts`, `src/modules/health/health.controller.ts`, `src/common/http/http-exception.filter.ts`, `prisma/migrations/0001_init_platform/migration.sql`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2      | Authentication and Identity                | Phase 1   | COMPLETE |     100% | `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/guards/supabase-jwt-auth.guard.ts`, `src/modules/auth/supabase-jwt.service.ts`, `test/auth.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3      | Groups and Join Codes                      | Phase 1   | COMPLETE |     100% | `prisma/migrations/0002_module3_groups_join_codes/migration.sql`, `src/modules/groups/groups.controller.ts`, `src/modules/groups/groups.service.ts`, `test/groups.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4      | Member Management and RBAC                 | Phase 1   | COMPLETE |     100% | `src/modules/groups/groups.controller.ts`, `src/modules/groups/groups.service.ts`, `src/modules/groups/dto/update-member-role.dto.ts`, `prisma/migrations/0003_module4_member_management_rbac/migration.sql`, `test/groups.e2e-spec.ts`, `test/modules/groups/groups.service.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5      | Chore Management                           | Phase 2   | COMPLETE |     100% | `prisma/migrations/20260305193953_0005_module5_chores/migration.sql`, `src/modules/chores/chores.module.ts`, `src/modules/chores/chores.service.ts`, `src/modules/chores/chores.controller.ts`, `src/modules/chores/dto/create-chore.dto.ts`, `src/modules/chores/dto/list-chores.query.ts`, `src/modules/chores/dto/update-chore-assignee.dto.ts`, `src/modules/chores/interfaces/chore-response.interface.ts`, `test/modules/chores/chores.service.spec.ts`, `test/chores.e2e-spec.ts`                                                                                                                                                                                                                                                                                      |
| 6      | Bills, Splits, Payments, and Balances      | Phase 3   | COMPLETE |     100% | `prisma/migrations/20260305213000_0007_module6_finance/migration.sql`, `src/modules/finance/finance.module.ts`, `src/modules/finance/finance.controller.ts`, `src/modules/finance/finance.service.ts`, `src/modules/finance/dto/create-bill.dto.ts`, `src/modules/finance/dto/create-payment.dto.ts`, `src/modules/finance/interfaces/finance-response.interface.ts`, `test/modules/finance/finance.service.spec.ts`, `test/finance.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                              |
| 7      | Contract Management                        | Phase 2   | COMPLETE |     100% | `prisma/migrations/20260305195941_0006_module7_contracts/migration.sql`, `src/modules/contracts/contracts.module.ts`, `src/modules/contracts/contracts.service.ts`, `src/modules/contracts/contracts.controller.ts`, `src/modules/contracts/dto/update-contract-draft.dto.ts`, `src/modules/contracts/interfaces/contract-response.interface.ts`, `test/modules/contracts/contracts.service.spec.ts`, `test/contracts.e2e-spec.ts`                                                                                                                                                                                                                                                                                                                                            |
| 8      | API UX Layer for Frontend Integration      | Phase 2/3 | COMPLETE |     100% | `src/common/http/dto/pagination-query.dto.ts`, `src/common/http/pagination.ts`, `src/modules/groups/groups.controller.ts`, `src/modules/groups/groups.service.ts`, `src/modules/chores/chores.controller.ts`, `src/modules/contracts/contracts.controller.ts`, `src/modules/finance/finance.controller.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/health/health.controller.ts`, `openapi/openapi.json`, `scripts/check-openapi.ts`, `scripts/generate-openapi-types.ts`, `scripts/check-openapi-types.ts`, `frontend/generated/backend-api.types.ts`, pagination/sort validation + dashboard aggregation + enriched envelope examples + response-envelope contract e2e coverage |
| 9      | Security and Compliance Hardening          | Phase 4   | PARTIAL  |      30% | `src/common/http/http-exception.filter.ts` (info leakage prevention + server-side logging), `src/modules/auth/dto/register.dto.ts` + `login.dto.ts` (password max-length), `src/common/http/parse-app-id.pipe.ts` (strict app ID validation), `src/modules/groups/groups.controller.ts` (ParseAppIdPipe/ParseUUIDPipe), `src/modules/groups/groups.service.ts` (Serializable isolation + rejoin role reset + self-demotion guard)                                                                                                                                                                                                                                                                                                                                             |
| 10     | Reliability, Observability, and Operations | Phase 4   | PARTIAL  |      65% | `src/app.module.ts` (structured logging + request IDs + redaction), `src/modules/health/health.controller.ts` + `health.service.ts` (hardened error reporting + server-side logging), `src/common/http/http-exception.filter.ts` (500-class error logging)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11     | Testing and Quality Gates                  | Phase 4   | PARTIAL  |      94% | `test/health.e2e-spec.ts`, `test/auth.e2e-spec.ts`, `test/groups.e2e-spec.ts`, `test/chores.e2e-spec.ts`, `test/contracts.e2e-spec.ts`, `test/finance.e2e-spec.ts`, `test/response-envelope-contract.e2e-spec.ts`, `test/live-supabase-smoke.e2e-spec.ts`, `test/live-user-journey.e2e-spec.ts`, `test/modules/groups/groups.service.spec.ts`, `test/modules/chores/chores.service.spec.ts`, `test/modules/contracts/contracts.service.spec.ts`, `test/modules/finance/finance.service.spec.ts`, `test/modules/auth/supabase-jwt-auth.guard.spec.ts`, `test/modules/health/health.service.spec.ts`, `test/common/http/parse-app-id.pipe.spec.ts`, `test/config/env.schema.spec.ts`, `.github/workflows/backend-ci.yml`, `package.json` (`verify`); 54 unit + 57 e2e tests passing, 2 optional live suites skipped by default |

### Machine-Readable Snapshot (JSON)

```json
{
  "last_verified": "2026-03-05",
  "status_legend": ["NOT_STARTED", "PARTIAL", "COMPLETE", "BLOCKED"],
  "modules": [
    {
      "id": 1,
      "name": "Platform Foundation",
      "phase": "Phase 1",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 2,
      "name": "Authentication and Identity",
      "phase": "Phase 1",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 3,
      "name": "Groups and Join Codes",
      "phase": "Phase 1",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 4,
      "name": "Member Management and RBAC",
      "phase": "Phase 1",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 5,
      "name": "Chore Management",
      "phase": "Phase 2",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 6,
      "name": "Bills, Splits, Payments, and Balances",
      "phase": "Phase 3",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 7,
      "name": "Contract Management",
      "phase": "Phase 2",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 8,
      "name": "API UX Layer for Frontend Integration",
      "phase": "Phase 2/3",
      "status": "COMPLETE",
      "progress_pct": 100
    },
    {
      "id": 9,
      "name": "Security and Compliance Hardening",
      "phase": "Phase 4",
      "status": "PARTIAL",
      "progress_pct": 30
    },
    {
      "id": 10,
      "name": "Reliability, Observability, and Operations",
      "phase": "Phase 4",
      "status": "PARTIAL",
      "progress_pct": 65
    },
    {
      "id": 11,
      "name": "Testing and Quality Gates",
      "phase": "Phase 4",
      "status": "PARTIAL",
      "progress_pct": 94
    }
  ]
}
```

## Module Breakdown

### Module 1: Platform Foundation

Scope:

- Backend project structure and configuration.
- Environment management and secret handling.
- Database connection, migrations, and seed framework.
- Common response/error format.
- Health/readiness endpoints.

Outputs:

- Base API app skeleton.
- Global error middleware.
- Validation pipeline.
- CI-ready startup scripts.

Frontend support impact:

- Predictable API conventions and response schema.
- Stable dev/stage/prod setup for integration.

---

### Module 2: Authentication and Identity

Scope:

- Account registration.
- Login and token/session issuance.
- Auth middleware for protected routes.
- Password hashing and secure credential flow.
- User profile retrieval for logged-in user context.

Core endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

Data entities:

- `users`
- `auth_sessions` (if session-based) or token metadata (if JWT-based)

Frontend support impact:

- Enables guarded routes.
- Provides current user context for UI state and permissions.

---

### Module 3: Groups and Join Codes

Scope:

- Create roommate group.
- Join group by join code.
- Generate/reset join code (admin only).
- Ensure group creator is admin.

Core endpoints:

- `POST /api/v1/groups`
- `POST /api/v1/groups/join`
- `POST /api/v1/groups/:groupId/join-code/reset`
- `GET /api/v1/groups/:groupId`

Data entities:

- `groups`
- `group_members`
- `join_codes`

Frontend support impact:

- Supports onboarding and household setup.
- Supports group-switching views and group context.

---

### Module 4: Member Management and RBAC

Scope:

- List group members.
- Remove members (admin only).
- Change member roles (admin only).
- Enforce non-admin restrictions.

Core endpoints:

- `GET /api/v1/groups/:groupId/members`
- `PATCH /api/v1/groups/:groupId/members/:userId/role`
- `DELETE /api/v1/groups/:groupId/members/:userId`

Data entities:

- `group_members` (role + membership status)
- `audit_logs` (admin actions)

Frontend support impact:

- Enables admin UI for membership control.
- Provides role-aware rendering and action enable/disable logic.

---

### Module 5: Chore Management

Scope:

- Create chores.
- Reassign chore occurrences.
- Mark chores complete.
- List/filter chores by group, assignee, status, due date.

Core endpoints:

- `POST /api/v1/groups/:groupId/chores`
- `GET /api/v1/groups/:groupId/chores`
- `PATCH /api/v1/chores/:occurrenceId/assignee`
- `PATCH /api/v1/chores/:occurrenceId/complete`

Data entities:

- `chores`
- `chore_activity` (optional audit trail)

Frontend support impact:

- Supports dashboard cards, filters, completion flows, and assignment UI.

---

### Module 6: Bills, Splits, Payments, and Balances

Scope:

- Create bills and split across members.
- Record payments.
- Automatically update and compute balances.
- Expose “who owes whom” summary.

Core endpoints:

- `POST /api/v1/groups/:groupId/bills`
- `GET /api/v1/groups/:groupId/bills`
- `POST /api/v1/groups/:groupId/payments`
- `GET /api/v1/groups/:groupId/balances`

Data entities:

- `bills`
- `bill_splits`
- `payments`
- `ledger_entries` (recommended for robust, auditable balance calculations)

Frontend support impact:

- Powers finance pages, settlement screens, and live balance indicators.

---

### Module 7: Contract Management

Scope:

- View contract for group members.
- Edit contract draft (admin only).
- Publish contract version (admin only).
- Maintain version history.

Core endpoints:

- `GET /api/v1/groups/:groupId/contract`
- `PUT /api/v1/groups/:groupId/contract`
- `POST /api/v1/groups/:groupId/contract/publish`
- `GET /api/v1/groups/:groupId/contract/versions`

Data entities:

- `contracts`
- `contract_versions`

Frontend support impact:

- Enables read/edit/publish flows and contract history views.

---

### Module 8: API UX Layer for Frontend Integration

Scope:

- Pagination, filtering, sorting standards.
- Error code catalog and field-level validation messages.
- API docs (OpenAPI/Swagger).
- Optional aggregation endpoints for dashboard views.

Core outputs:

- OpenAPI spec kept in sync with implementation.
- DTO/response schemas with consistent naming.
- Contract tests to prevent breaking frontend.

Frontend support impact:

- Faster frontend development and fewer integration regressions.

---

### Module 9: Security and Compliance Hardening

Scope:

- Rate limiting on auth and sensitive endpoints.
- Input sanitization and schema validation.
- RBAC enforcement tests.
- Sensitive data protection and secure headers.

Core outputs:

- Security middleware set.
- Threat-focused test cases (auth bypass, privilege escalation attempts).

Frontend support impact:

- Safer production behavior with stable, expected failures for invalid actions.

---

### Module 10: Reliability, Observability, and Operations

Scope:

- Structured logging and request tracing.
- Metrics (latency, error rates, route throughput).
- Health checks and readiness checks.
- Retry-safe patterns and idempotency for financial endpoints.

Core outputs:

- Observability dashboard-ready metrics/log fields.
- Alerting hooks for elevated error rates.

Frontend support impact:

- Better uptime and faster issue diagnosis when UI reports API failures.

---

### Module 11: Testing and Quality Gates

Scope:

- Unit tests for core business logic.
- Integration tests for all endpoints.
- End-to-end workflow tests.
- CI quality gates (tests, lint, migration checks).

Core workflows to test:

- Register -> Login -> Create Group -> Join Member.
- Admin role changes and member removal.
- Chore occurrence create/reassign/complete.
- Bill create/split -> Payment record -> Balance accuracy.
- Contract edit/publish/view with role restrictions.

Frontend support impact:

- Stable API behavior and confidence during frontend release cycles.

## Phase Assignment

### Phase 1: Core Platform and Access

Modules:

- Module 1: Platform Foundation
- Module 2: Authentication and Identity
- Module 3: Groups and Join Codes
- Module 4: Member Management and RBAC

Phase objective:

- Deliver secure multi-user, multi-group foundation with role-aware access.

Exit criteria:

- Users can register/login.
- Groups can be created/joined by code.
- Admin permissions are enforced for membership management.

### Phase 2: Operational Roommate Features

Modules:

- Module 5: Chore Management
- Module 7: Contract Management
- Module 8: API UX standards (validation/error contract + enriched docs)

Phase objective:

- Deliver day-to-day group operations (chores + contract workflows).

Exit criteria:

- Full chore lifecycle works for group members.
- Contract view/edit/publish rules are enforced.
- Frontend can integrate using documented schemas and predictable errors.

### Phase 3: Financial Engine

Modules:

- Module 6: Bills, Splits, Payments, and Balances

Phase objective:

- Deliver robust, accurate, and auditable financial workflows.

Exit criteria:

- Bill splitting and payment recording work with transactional integrity.
- Balance calculations remain correct across edge cases.
- “Who owes whom” is deterministic and test-covered.

### Phase 4: Production Hardening

Modules:

- Module 9: Security and Compliance Hardening
- Module 10: Reliability, Observability, and Operations
- Module 11: Testing and Quality Gates

Phase objective:

- Raise backend to production-grade reliability and security levels.

Exit criteria:

- Security controls enabled and verified.
- Monitoring, logging, and health checks operational.
- CI enforces quality gates with high-confidence regression coverage.

## Phase Progress Snapshot (As of 2026-03-05)

- Phase 1: `COMPLETE` (Modules 1-4 complete and validated)
- Phase 2: `COMPLETE` (Modules 5, 7, and 8 complete)
- Phase 3: `COMPLETE` (Module 6 complete; cross-phase Module 8 deliverables complete)
- Phase 4: `PARTIAL_FOUNDATION` (security hardening at 30%, reliability/observability at 65%, testing at 94% via hardening audit)

## Frontend-Readiness Checklist

- Stable API versioning (`/api/v1`).
- Consistent response envelope and error schema.
- Pagination/filtering for list endpoints.
- RBAC-aware endpoint behavior aligned with frontend role-based UI.
- OpenAPI spec published and updated per change.
- Seed data and mock-friendly fixtures for frontend development.

## Suggested Delivery Order Inside Each Phase

- Start with data model + migrations.
- Implement service/business layer.
- Expose routes/controllers.
- Add auth/RBAC guards.
- Add tests.
- Update API docs.

## Key Risks and Mitigations

- Risk: Incorrect balance calculations.
  Mitigation: Use ledger-based model + transaction boundaries + dedicated test suite.

- Risk: Privilege escalation through missing checks.
  Mitigation: Centralize authorization middleware + endpoint-level RBAC tests.

- Risk: Frontend/backend contract drift.
  Mitigation: OpenAPI-driven contracts + integration tests in CI.

- Risk: Data inconsistency from partial writes.
  Mitigation: DB transactions for multi-step operations and idempotency keys for payments.

## Definition of Done (Backend)

- Functional requirements are implemented and validated by tests.
- Non-functional requirements have enforceable controls (security/performance/reliability).
- API contracts are documented, versioned, and frontend-consumable.
- Critical workflows pass automated integration/e2e tests.
