<div align="center">

# 🏛 Architecture

*How a quiet click in a cozy interface becomes a durable fact in the database.*

</div>

---

> **The shape of the system.** RoomieManager is a small constellation: a Vite-built React app on Vercel, a NestJS API on an OCI VM behind Caddy, and Supabase holding identity and data. Every piece is intentionally straightforward so the product can feel calm.

— · — · — · —

## 🌿 The Journey Of A Single Request

Imagine a roommate marks a chore complete.

```text
Browser or Android app
  |
  | HTTPS + Bearer JWT
  v
Caddy on OCI
  |
  | reverse proxy
  v
NestJS API in Docker
  |-- validates DTOs and route params
  |-- verifies Supabase JWT with jose/JWKS
  |-- enforces group membership and RBAC
  |-- logs request context with Pino
  |
  | Prisma
  v
Supabase Postgres
```

1. **The click** travels from web or Android to `https://api.roomiemanager.site/api/v1`.
2. **Caddy** terminates HTTPS for the API domain and forwards to the NestJS container.
3. **NestJS guards** verify the Supabase-issued JWT with `jose` and JWKS.
4. **Validation** rejects malformed input before it reaches business logic.
5. **RBAC** checks the caller's active group membership and role.
6. **Prisma** writes the state change to Supabase Postgres.
7. **The response envelope** returns with `success`, `data`, request ID, and timestamp.

— · — · — · —

## 🧱 The Pieces, By Responsibility

<table>
  <tr>
    <th width="22%">Layer</th>
    <th width="30%">Tech</th>
    <th>Why it belongs here</th>
  </tr>
  <tr>
    <td><strong>Web client</strong></td>
    <td>React 18, TypeScript, Vite 6, Tailwind, React Router, lucide-react</td>
    <td>Fast local feedback, a soft design system, and route-level screens for household workflows.</td>
  </tr>
  <tr>
    <td><strong>Android client</strong></td>
    <td>Flutter, Material 3, Provider, GoRouter, secure storage, http</td>
    <td>The same product model in a mobile-first shell, without a separate mobile backend.</td>
  </tr>
  <tr>
    <td><strong>API</strong></td>
    <td>NestJS 10, class-validator, Zod, Pino</td>
    <td>Domain modules map cleanly to product areas: groups, chores, finance, contracts, and auth.</td>
  </tr>
  <tr>
    <td><strong>Data</strong></td>
    <td>Prisma 5, Supabase Postgres</td>
    <td>Prisma owns schema and migrations; Supabase owns the managed Postgres cluster.</td>
  </tr>
  <tr>
    <td><strong>Identity</strong></td>
    <td>Supabase Auth, jose</td>
    <td>Supabase issues tokens; the backend independently verifies JWTs server-side.</td>
  </tr>
  <tr>
    <td><strong>Runtime</strong></td>
    <td>Docker Compose on OCI, Caddy, GHCR</td>
    <td>Reproducible backend image, simple VM operations, automatic HTTPS at the edge.</td>
  </tr>
  <tr>
    <td><strong>Frontend hosting</strong></td>
    <td>Vercel</td>
    <td>Static SPA delivery for the web app with a deployment workflow that stays out of the way.</td>
  </tr>
</table>

— · — · — · —

## 🎯 Product Domains

The API is organized around the way roommates live, not around generic CRUD buckets.

| Domain | What lives here |
| --- | --- |
| **Groups and members** | Join codes, active memberships, role-based access, safe leave/remove flows |
| **Chores** | One-off chores, recurring templates, assignments, completion, activity, calendar views |
| **Finance** | Bills, splits, payments, ledger entries, balances, settlement suggestions |
| **Contracts** | Drafts, published versions, and version history |
| **Auth** | Register, login, current user, email verification, password recovery |

Each domain has NestJS controllers, services, DTOs, and tests. Shared infrastructure lives under `src/common/`.

— · — · — · —

## 🔐 Trust Boundaries

```text
[ Web / Android ]
       |
       | Authorization: Bearer <Supabase JWT>
       v
[ NestJS Guard ] -- verifies signature via JWKS --> [ Supabase Auth ]
       |
       | membership + role lookup
       v
[ Prisma ] --------------------------------------> [ Supabase Postgres ]
```

- Tokens are issued by **Supabase Auth** and verified by the backend before protected routes run.
- Group-level permissions are enforced from persisted membership records.
- Database access goes through **Prisma**.
- Responses are wrapped consistently for web and Android clients.

— · — · — · —

## 🚢 How A Change Ships

```text
push / PR
  |
  v
GitHub Actions
  |-- Prisma generate
  |-- migration status
  |-- lint
  |-- unit + e2e tests
  |-- build
  |-- OpenAPI drift check
  |-- generated frontend type check
  |
  v
backend image to GHCR
  |
  v
OCI VM + Docker Compose + Caddy
```

The web frontend deploys to Vercel. The backend runs as a Dockerized NestJS service on OCI, fronted by Caddy for HTTPS, with Supabase providing managed Postgres and Auth.

— · — · — · —

## 📚 Where To Go Next

- [backend/README.md](backend/README.md) - the API in detail
- [frontend/README.md](frontend/README.md) - the interface in detail
- [docs/README.md](docs/README.md) - assets and reference links
- [Live Swagger](https://api.roomiemanager.site/api/docs) - current API contract
