# RoomieManager Backend

The backend is the source of truth for RoomieManager's household workflows. It owns auth integration, group membership, RBAC, chores, shared finance, contracts, response envelopes, OpenAPI generation, and deployment-ready runtime behavior for both the web and Android apps.

**Production API:** [api.roomiemanager.site/api/v1](https://api.roomiemanager.site/api/v1)<br>
**Swagger docs:** [api.roomiemanager.site/api/docs](https://api.roomiemanager.site/api/docs)<br>
**Deployment guide:** [docs/oci-docker-cicd-deploy.md](docs/oci-docker-cicd-deploy.md)

## What It Owns

- Supabase Auth integration for register, login, current user, email-action exchange, password recovery, and password updates.
- Group membership lifecycle with join codes, admin/member RBAC, safe removal, and leave flows.
- Chores, recurring chore templates, calendar-ready occurrence data, and completion activity.
- Shared finances with bills, member splits, payments, ledger entries, balances, and settlement views.
- Group contracts with editable drafts, published versions, and history.
- Health probes, request IDs, wrapped responses, OpenAPI generation, and generated frontend API types.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | NestJS 10 |
| Language | TypeScript |
| ORM | Prisma 5 |
| Database | Supabase Postgres |
| Auth | Supabase Auth, JWT verification with `jose` |
| Validation | Zod, class-validator, global ValidationPipe |
| Logging | Pino through `nestjs-pino` |

## API Contract

Local API base: `http://localhost:3000/api/v1`<br>
Local Swagger docs: `http://localhost:3000/api/docs`

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

Errors use the same wrapper with `success: false`, a stable error code, a message, optional details, and the same metadata. OpenAPI is generated into [openapi/openapi.json](openapi/openapi.json), and frontend types are generated into [../frontend/generated/backend-api.types.ts](../frontend/generated/backend-api.types.ts).

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

Fill `.env` with Supabase database and auth values before running migrations or auth-backed flows.

## Environment

Use [.env.example](.env.example) as the full reference. The key production-shaped values are:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres connection string. |
| `SUPABASE_URL` | Supabase project URL for auth and JWKS discovery. |
| `SUPABASE_ANON_KEY` | Public Supabase key used for auth requests. |
| `SUPABASE_JWT_AUDIENCE` | Expected JWT audience, typically `authenticated`. |
| `CORS_ORIGINS` | Web origins allowed to call the API. |
| `SUPABASE_AUTH_REDIRECT_URL` | Email action callback URL, production value is `https://roomiemanager.site/auth/callback`. |

Do not commit production secrets.

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

`pnpm verify` is the main backend confidence gate. It generates Prisma, checks migration status, lints, runs unit and e2e tests, builds, verifies OpenAPI drift, and checks generated frontend API types.

## Production Shape

Production runs as a Dockerized NestJS service on OCI:

- GitHub Actions builds and publishes the backend Docker image to GHCR.
- Docker Compose runs the backend behind Caddy on localhost port `3001`.
- Caddy terminates HTTPS for `api.roomiemanager.site`.
- Supabase handles Postgres and Auth.
- Supabase Auth uses Resend SMTP for verification and password recovery email.

Runtime assets live in [deploy/](deploy/). The full deployment walkthrough is [docs/oci-docker-cicd-deploy.md](docs/oci-docker-cicd-deploy.md).
