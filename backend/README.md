# RoomieManager Backend

The backend is the source of truth for RoomieManager's household workflows. It keeps groups, roles, chores, bills, payments, balances, contracts, auth callbacks, and API contracts consistent across the web and Android apps.

[Production API](https://api.roomiemanager.site/api/v1/health/live) | [Swagger docs](https://api.roomiemanager.site/api/docs) | [Deployment notes](docs/oci-docker-cicd-deploy.md)

## What It Owns

- Supabase Auth integration for register, login, current user, email-action exchange, password recovery, and password updates.
- Group membership lifecycle with join codes, admin/member RBAC, safe removal, and leave flows.
- Chores, recurring chore templates, calendar-ready occurrence data, and completion activity.
- Shared finances with bills, member splits, payments, ledger entries, balances, and settlement views.
- Group contracts with editable drafts, published versions, and history.
- Health probes, request IDs, wrapped responses, OpenAPI generation, and generated frontend API types.

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

Local API base: `http://localhost:3000/api/v1`

Swagger docs: `http://localhost:3000/api/docs`

## Environment

The backend expects Supabase-backed runtime configuration:

- `DATABASE_URL` uses the Supabase session pooler on port `5432` with `sslmode=require`.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` enable Supabase Auth calls.
- `SUPABASE_JWT_AUDIENCE=authenticated` matches the production JWT audience.
- `CORS_ORIGINS` should include the web origins that may call the API.
- `SUPABASE_AUTH_REDIRECT_URL=https://roomiemanager.site/auth/callback` is used for email action links.

Use `.env.example` as the full reference.

## Quality Commands

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm openapi:generate
pnpm openapi:check
pnpm verify
```

`pnpm verify` is the main confidence gate. It generates Prisma, checks migration status, lints, runs unit and e2e tests, builds, verifies OpenAPI drift, and checks generated frontend API types.

## Deployment Shape

Production runs as a Dockerized NestJS service on OCI:

- Docker image is built by GitHub Actions and published to GHCR.
- Docker Compose runs the backend behind Caddy on localhost port `3001`.
- Caddy terminates HTTPS for `api.roomiemanager.site`.
- Supabase handles Postgres and Auth.
- Resend SMTP is configured in Supabase for verification and password recovery email.

Runtime assets live in [`deploy/`](deploy/). The full deployment walkthrough is in [`docs/oci-docker-cicd-deploy.md`](docs/oci-docker-cicd-deploy.md).

## API Contract

Every response uses the same envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

OpenAPI is generated into [`openapi/openapi.json`](openapi/openapi.json), and frontend types are generated into [`../frontend/generated/backend-api.types.ts`](../frontend/generated/backend-api.types.ts).
