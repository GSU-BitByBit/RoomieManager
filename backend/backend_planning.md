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

### Recommended Backend Stack
- Runtime and language: `Node.js` + `TypeScript`
- API framework: `NestJS` (preferred for module structure) or `Fastify` (performance-focused)
- Database: `Supabase Postgres`
- ORM and migrations: `Prisma`
- Auth: `Supabase Auth` token verification in backend middleware
- Validation: `zod` or `class-validator` (framework-dependent)
- API contract: `OpenAPI/Swagger`
- Testing: `Jest` + `Supertest`
- Background jobs (optional, for reminders/reconciliation): `BullMQ` + Redis
- Observability: structured logs + Sentry + metrics endpoint

## Technology Rollout by Phase

### Phase 1 Technology Rollout (Modules 1-4)
- Set up `Node.js + TypeScript`, project skeleton, config, logging, and global error handling.
- Connect backend to `Supabase Postgres` via `Prisma`; create baseline schema and migrations.
- Integrate `Supabase Auth` verification for protected routes.
- Implement RBAC middleware for group/member/admin roles.
- Publish baseline `OpenAPI` spec for auth/group/member endpoints.

### Phase 2 Technology Rollout (Modules 5, 7, and Module 8 partial)
- Reuse Phase 1 stack to add chores and contract domain modules.
- Add pagination/filtering standards and consistent validation/error objects.
- Add optional `Supabase Realtime` events for chore status and contract publish updates.

### Phase 3 Technology Rollout (Module 6 and Module 8 remaining)
- Implement financial engine on `Supabase Postgres` with transactional `Prisma` operations.
- Use ledger-style tables for auditable balance computation.
- Add idempotency key handling for payment recording endpoints.
- Extend `OpenAPI` with bill/payment/balance contracts and examples.

### Phase 4 Technology Rollout (Modules 9-11)
- Security hardening: rate limits, secure headers, stricter input validation, auth abuse controls.
- Reliability and operations: tracing IDs, metrics, alert-friendly logs, readiness checks.
- CI quality gates: tests, linting, migration checks, and contract test enforcement.

## Module-to-Technology Mapping
- Module 1 (Platform Foundation): `Node.js`, `TypeScript`, `NestJS/Fastify`, configuration, logging, health endpoints.
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

## AI Module Tracking
Purpose:
- Give human and AI contributors one canonical place to check backend module completion.
- Reduce ambiguity before planning or implementing the next change.

Last verified:
- `2026-02-23`

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

| Module | Name | Phase | Status | Progress | Evidence |
|---|---|---|---|---:|---|
| 1 | Platform Foundation | Phase 1 | COMPLETE | 100% | `src/main.ts`, `src/app.module.ts`, `src/modules/health/health.controller.ts`, `src/common/http/http-exception.filter.ts`, `prisma/migrations/0001_init_platform/migration.sql` |
| 2 | Authentication and Identity | Phase 1 | NOT_STARTED | 0% | N/A |
| 3 | Groups and Join Codes | Phase 1 | NOT_STARTED | 0% | N/A |
| 4 | Member Management and RBAC | Phase 1 | NOT_STARTED | 0% | N/A |
| 5 | Chore Management | Phase 2 | NOT_STARTED | 0% | N/A |
| 6 | Bills, Splits, Payments, and Balances | Phase 3 | NOT_STARTED | 0% | N/A |
| 7 | Contract Management | Phase 2 | NOT_STARTED | 0% | N/A |
| 8 | API UX Layer for Frontend Integration | Phase 2/3 | PARTIAL | 30% | `src/main.ts` (Swagger setup), `src/common/http/response.interceptor.ts`, `src/common/http/http-error-code.ts` |
| 9 | Security and Compliance Hardening | Phase 4 | NOT_STARTED | 0% | N/A |
| 10 | Reliability, Observability, and Operations | Phase 4 | PARTIAL | 35% | `src/app.module.ts` (structured logging), `src/modules/health/health.controller.ts`, `src/modules/health/health.service.ts` |
| 11 | Testing and Quality Gates | Phase 4 | PARTIAL | 40% | `test/health.e2e-spec.ts`, `test/modules/health/health.service.spec.ts`, `.github/workflows/backend-ci.yml` |

### Machine-Readable Snapshot (JSON)

```json
{
  "last_verified": "2026-02-23",
  "status_legend": ["NOT_STARTED", "PARTIAL", "COMPLETE", "BLOCKED"],
  "modules": [
    { "id": 1, "name": "Platform Foundation", "phase": "Phase 1", "status": "COMPLETE", "progress_pct": 100 },
    { "id": 2, "name": "Authentication and Identity", "phase": "Phase 1", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 3, "name": "Groups and Join Codes", "phase": "Phase 1", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 4, "name": "Member Management and RBAC", "phase": "Phase 1", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 5, "name": "Chore Management", "phase": "Phase 2", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 6, "name": "Bills, Splits, Payments, and Balances", "phase": "Phase 3", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 7, "name": "Contract Management", "phase": "Phase 2", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 8, "name": "API UX Layer for Frontend Integration", "phase": "Phase 2/3", "status": "PARTIAL", "progress_pct": 30 },
    { "id": 9, "name": "Security and Compliance Hardening", "phase": "Phase 4", "status": "NOT_STARTED", "progress_pct": 0 },
    { "id": 10, "name": "Reliability, Observability, and Operations", "phase": "Phase 4", "status": "PARTIAL", "progress_pct": 35 },
    { "id": 11, "name": "Testing and Quality Gates", "phase": "Phase 4", "status": "PARTIAL", "progress_pct": 40 }
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
- Assign chores.
- Mark chores complete.
- List/filter chores by group, assignee, status, due date.

Core endpoints:
- `POST /api/v1/groups/:groupId/chores`
- `GET /api/v1/groups/:groupId/chores`
- `PATCH /api/v1/chores/:choreId/assign`
- `PATCH /api/v1/chores/:choreId/complete`

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
- Chore create/assign/complete.
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
- Module 8 (partial): API UX standards (validation/error contract + baseline docs)

Phase objective:
- Deliver day-to-day group operations (chores + contract workflows).

Exit criteria:
- Full chore lifecycle works for group members.
- Contract view/edit/publish rules are enforced.
- Frontend can integrate using documented schemas and predictable errors.

### Phase 3: Financial Engine
Modules:
- Module 6: Bills, Splits, Payments, and Balances
- Module 8 (remaining): advanced docs + aggregation endpoints

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
