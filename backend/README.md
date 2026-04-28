<div align="center">

# ⚙️ RoomieManager Backend

*The rules of the house, expressed in TypeScript.*

[![NestJS](https://img.shields.io/badge/NestJS-10-3F7D4E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-5-3F7D4E?logo=prisma&logoColor=white)](https://prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-6B8E5A?logo=supabase&logoColor=white)](https://supabase.com)
[![Swagger](https://img.shields.io/badge/Swagger-live-A8C09A)](https://api.roomiemanager.site/api/docs)

</div>

---

> **What this is.** A NestJS 10 service that owns groups, chores, finance, contracts, and the auth boundary against Supabase. Validation is strict, logs are structured, and the OpenAPI document is a first-class artifact.

— · — · — · —

## 🧱 What's In The Box

| Concern | Tool |
| --- | --- |
| Framework | **NestJS 10** |
| ORM and migrations | **Prisma 5** |
| Database | **Supabase Postgres** |
| Identity | **Supabase Auth**, verified server-side with **`jose`** and JWKS |
| Validation | **class-validator** DTOs and **Zod** config validation |
| Logging | **Pino** through `nestjs-pino` |
| API docs | **Swagger / OpenAPI**, generated and checked |

— · — · — · —

## 🚀 Run It Locally

> **Prereqs:** Node 20+, **pnpm 9**, and a reachable Supabase project.

```bash
cd backend
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

API: `http://localhost:3000/api/v1`<br />
Swagger: `http://localhost:3000/api/docs`

Fill `.env` with Supabase database and auth values before running migrations or auth-backed flows.

— · — · — · —

## 🛠 Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the API in watch mode |
| `pnpm build` | Compile the production bundle |
| `pnpm lint` | Lint with zero warnings |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm prisma:generate` | Regenerate the Prisma client |
| `pnpm prisma:migrate:deploy` | Apply migrations to the configured database |
| `pnpm openapi:generate` | Emit OpenAPI and generated frontend types |
| `pnpm openapi:check` | Fail if the OpenAPI document drifted |
| `pnpm verify` | The full backend confidence gate |

— · — · — · —

## 🧩 Domain Modules

```text
src/
├── modules/
│   ├── auth/        JWT verification, email actions, password recovery
│   ├── groups/      Households, join codes, members, RBAC
│   ├── chores/      One-off chores, recurring templates, calendar
│   ├── finance/     Bills, splits, payments, balances, settlements
│   ├── contracts/   Drafts, published versions, history
│   └── health/      Liveness and readiness probes
└── common/          Prisma, Supabase URL helpers, response envelope, filters
```

Each module keeps controllers thin and puts business rules in services. Multi-step admin mutations use Prisma transactions where the domain needs consistency.

— · — · — · —

## 🔐 How Auth Works

1. The web or Android client signs in through the backend auth endpoints backed by **Supabase Auth**.
2. The client stores the returned session and attaches the access token on protected API requests.
3. A **NestJS guard** uses **`jose`** to verify the token against Supabase's **JWKS** endpoint.
4. The backend resolves group membership and role before protected household actions run.

No protected controller handler runs before authentication and authorization have been checked.

— · — · — · —

## 🧪 Verification And CI

`pnpm verify` runs Prisma generation, migration status, linting, unit tests, e2e tests, TypeScript build, OpenAPI drift checks, and generated frontend type checks.

The GitHub Actions pipeline runs the backend verification path and supports the production image/deploy flow.

— · — · — · —

## 🚢 Production Shape

- Docker image built and published to **GHCR**.
- Backend service run by **Docker Compose** on an **OCI VM**.
- **Caddy** terminates HTTPS for `api.roomiemanager.site`.
- **Supabase** provides Postgres and Auth.
- Supabase Auth uses production email verification and password recovery flows.

See [../ARCHITECTURE.md](../ARCHITECTURE.md) for the full system topology and [docs/oci-docker-cicd-deploy.md](docs/oci-docker-cicd-deploy.md) for operational notes.
