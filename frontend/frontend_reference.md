# Frontend Integration Reference (RoomieManager Backend)

Last updated: 2026-03-05
Owner: Backend team
Scope: Practical integration guide for frontend engineers and frontend AI agents.

## 1) What exists right now

Current backend implementation level:

- Module 1 (Platform Foundation): COMPLETE
- Module 2 (Authentication and Identity): COMPLETE (register returns `201`; login requires `SUPABASE_ANON_KEY`)
- Module 3 (Groups and Join Codes): COMPLETE
- Module 4 (Member Management and RBAC): COMPLETE
- Module 5 (Chore Management): COMPLETE
- Module 6 (Bills, Splits, Payments, and Balances): COMPLETE
- Module 7 (Contract Management): COMPLETE
- Module 8 (API UX): COMPLETE (100%) -- standardized list pagination/sorting conventions, dashboard aggregation endpoint, enriched OpenAPI examples, and strict contract checks are live
- Module 9 (Security Hardening): PARTIAL (30%) -- info leakage prevention, input validation, Serializable transactions, strict ID validation
- Module 10 (Reliability): PARTIAL (65%) -- server-side error logging, hardened health probes
- Module 11 (Testing): PARTIAL (94%) -- 54 unit + 57 e2e tests passing, plus 2 optional live Supabase e2e suites skipped by default

This means:

- Implemented API endpoints right now: health + auth + groups + member management + chores + finance + contracts.
- Member-management endpoints are implemented, migrated, and validated in Supabase-backed smoke runs.
- Backend-wide security and quality hardening audit completed on `2026-03-05` (see changelog).
- Latest `pnpm verify` pipeline passed end-to-end on `2026-03-05` (57 e2e tests passing; live suites are opt-in).

Source-of-truth files:

- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/main.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/response.interceptor.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/http-exception.filter.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/http-error-code.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/dto/pagination-query.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/pagination.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/health/health.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/health/health.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/auth.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/auth.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/guards/supabase-jwt-auth.guard.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/groups.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/groups.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/dto/create-group.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/dto/update-member-role.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/dto/list-group-members.query.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/chores/dto/list-chores.query.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/contracts/dto/list-contract-versions.query.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/finance/dto/list-bills.query.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/finance/finance.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/finance/finance.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/finance/dto/create-bill.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/finance/dto/create-payment.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/supabase/supabase-url.util.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/app.module.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/prisma/schema.prisma`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/openapi/openapi.json`

## 2) Base URL and docs

Backend base URL (local):

- `http://localhost:3000`

Global API prefix:

- `/api/v1`

Effective API base URL for frontend calls:

- `http://localhost:3000/api/v1`

Swagger docs:

- `http://localhost:3000/api/docs`

## 3) Response contract (already enforced globally)

Every successful JSON response is wrapped:

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

Every error response is wrapped:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|INTERNAL_ERROR|SERVICE_UNAVAILABLE",
    "message": "human-readable",
    "details": {}
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

TypeScript helper types for frontend:

```ts
export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INTERNAL_ERROR"
      | "SERVICE_UNAVAILABLE";
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

## 3.1) List endpoint contract (pagination + sorting)

Shared query params on list routes:

- `page` (integer, minimum `1`, default `1`)
- `pageSize` (integer, minimum `1`, maximum `100`, default `20`)
- `sortBy` (enum per endpoint)
- `sortOrder` (`asc` or `desc`, defaults vary by endpoint)

Shared response shape on list routes:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Invalid pagination/sort input returns wrapped `400 BAD_REQUEST`.

Implemented list route defaults:

- `GET /api/v1/groups` defaults to `sortBy=updatedAt`, `sortOrder=desc`.
- `GET /api/v1/groups/:groupId/members` defaults to `sortBy=role`, `sortOrder=asc`.
- `GET /api/v1/groups/:groupId/chores` defaults to `sortBy=dueDate`, `sortOrder=asc`.
- `GET /api/v1/groups/:groupId/contract/versions` defaults to `sortBy=version`, `sortOrder=desc`.
- `GET /api/v1/groups/:groupId/bills` defaults to `sortBy=incurredAt`, `sortOrder=desc`.

## 4) Request ID behavior (important for debugging)

Backend behavior:

- If frontend sends `x-request-id`, backend reuses it.
- If not provided, backend generates one.
- Same request ID appears in response header and in `meta.requestId`.

Frontend recommendation:

- Generate a UUID per request in dev/staging and send it as `x-request-id`.
- Surface request ID in error logs/UI for easier backend tracing.

## 5) Implemented endpoints (available now)

### GET `/api/v1/health/live`

Purpose:

- Process liveness only.

Success response `200`:

```json
{
  "success": true,
  "data": {
    "service": "roomiemanager-backend",
    "version": "0.1.0",
    "timestamp": "2026-02-23T20:51:54.579Z"
  },
  "meta": {
    "requestId": "58748e53-738b-45a2-a760-38cfe07c9ae3",
    "timestamp": "2026-02-23T20:51:54.579Z"
  }
}
```

### GET `/api/v1/health/ready`

Purpose:

- Readiness check for DB connectivity and migration health.

Success response `200`:

```json
{
  "success": true,
  "data": {
    "checks": {
      "database": "ok",
      "migrations": "ok"
    }
  },
  "meta": {
    "requestId": "aa3cdd08-ecd4-4796-8088-47a2ef5a0455",
    "timestamp": "2026-02-23T20:51:54.827Z"
  }
}
```

Failure response `503` (`SERVICE_UNAVAILABLE`):

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service is not ready.",
    "details": {
      "checks": {
        "database": "fail",
        "migrations": "ok"
      }
    }
  },
  "meta": {
    "requestId": "external-request-id",
    "timestamp": "2026-02-23T20:51:54.827Z"
  }
}
```

Note: The `details` object only contains check statuses (`ok`/`fail`), not raw error messages. This is intentional to avoid leaking infrastructure details.

### POST `/api/v1/auth/register`

Purpose:

- Register a user in Supabase Auth via backend proxy.

Requirements:

- `SUPABASE_ANON_KEY` must be configured on backend.

Request body:

```json
{
  "email": "alex@example.com",
  "password": "StrongPass123!",
  "fullName": "Alex Smith"
}
```

Validation:

- `email` is required, must be a valid email.
- `password` is required, min length `8`, max length `128`.
- `fullName` is optional, max length `120`.

Success response `201`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "alex@example.com"
    },
    "session": null
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Behavior note:

- `data.session` may be `null` or a session object depending on Supabase project email confirmation settings.

Common failure `503` (if anon key missing):

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "SUPABASE_ANON_KEY is not configured."
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

### POST `/api/v1/auth/login`

Purpose:

- Login user against Supabase Auth via backend proxy.

Request body:

```json
{
  "email": "alex@example.com",
  "password": "StrongPass123!"
}
```

Validation:

- `email` is required, must be a valid email.
- `password` is required, min length `8`, max length `128`.

Success response `200`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "alex@example.com"
    },
    "session": {
      "accessToken": "jwt",
      "refreshToken": "refresh-token",
      "expiresIn": 3600,
      "tokenType": "bearer"
    }
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

### GET `/api/v1/auth/me`

Purpose:

- Validate bearer token and return current user claims.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Query params:

- `page` (optional, default `1`)
- `pageSize` (optional, default `20`, max `100`)
- `sortBy` (optional: `version`, `createdAt`; default `version`)
- `sortOrder` (optional: `asc`, `desc`; default `desc`)

Success response `200`:

```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "alex@example.com",
    "role": "authenticated",
    "aud": "authenticated"
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Failure response `401`:

- `error.code = UNAUTHORIZED` when token is missing, invalid, or expired.

### POST `/api/v1/groups`

Purpose:

- Create a roommate group.
- The caller becomes admin automatically.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Request body:

```json
{
  "name": "Apartment 12A"
}
```

Validation:

- `name` is required string, min length `1`, max length `120`.
- Backend trims `name` first; whitespace-only values are rejected.

Success response `201`:

```json
{
  "success": true,
  "data": {
    "id": "group-uuid",
    "name": "Apartment 12A",
    "createdBy": "user-uuid",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "memberRole": "ADMIN",
    "memberStatus": "ACTIVE",
    "memberCount": 1,
    "joinCode": "AB12CD34"
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Common failure responses:

- `400 BAD_REQUEST` for invalid payload (including whitespace-only `name`).
- `401 UNAUTHORIZED` when bearer token is missing/invalid.

### GET `/api/v1/groups`

Purpose:

- List active groups for the current authenticated user.
- Supports pagination and sorting for dashboard/group-switcher views.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Query params:

- `page` (optional, default `1`)
- `pageSize` (optional, default `20`, max `100`)
- `sortBy` (optional: `updatedAt`, `createdAt`, `name`, `joinedAt`; default `updatedAt`)
- `sortOrder` (optional: `asc`, `desc`; default `desc`)

Success response `200`:

- Returns `{ groups[], pagination }`.
- Each `groups[]` entry follows `GroupSummary` shape from create/get endpoints.
- `joinCode` is only present for groups where caller role is `ADMIN`.

Common failure responses:

- `400 BAD_REQUEST` for invalid pagination/sort query values.
- `401 UNAUTHORIZED` when bearer token is missing/invalid.

### POST `/api/v1/groups/join`

Purpose:

- Join a group using a join code.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Request body:

```json
{
  "joinCode": "AB12CD34"
}
```

Validation:

- `joinCode` is required string, min length `4`, max length `20`.
- Backend normalizes code to uppercase.

Success response `200`:

- Same `GroupSummary` envelope as create endpoint.
- `joinCode` is only present when caller role is `ADMIN`.

Common failure responses:

- `400 BAD_REQUEST` for invalid join code.
- `409 CONFLICT` when user is already an active member.

Behavior note:

- If a previously-removed member rejoins, their role is always reset to `MEMBER` regardless of what it was before removal.

### POST `/api/v1/groups/:groupId/join-code/reset`

Purpose:

- Reset and rotate group join code (admin only).

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

```json
{
  "success": true,
  "data": {
    "groupId": "group-uuid",
    "joinCode": "ZXCV9876"
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Common failure responses:

- `400 BAD_REQUEST` when `groupId` is not a valid app ID (`cuid` or UUID).
- `403 FORBIDDEN` when caller is not group admin.
- `403 FORBIDDEN` when caller is not an active member of the target group (including unknown group IDs).

### GET `/api/v1/groups/:groupId`

Purpose:

- Fetch group summary for current member context.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

- Same `GroupSummary` envelope as create endpoint.
- `joinCode` is only present for admins.

Common failure responses:

- `403 FORBIDDEN` when caller is not an active member.

### GET `/api/v1/groups/:groupId/dashboard`

Purpose:

- Return a frontend-ready aggregate payload for group dashboard cards and overview panels.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

- Returns:
  - `group` (`GroupSummary`, role-aware `joinCode` visibility)
  - `members` (`totalActive`, `adminCount`, `memberCount`)
  - `chores` (`pendingCount`, `completedCount`, `overdueCount`, `assignedToMePendingCount`)
  - `finance` (`billCount`, `paymentCount`, latest bill/payment timestamps)
  - `contract` (`hasDraft`, `publishedVersion`, `updatedAt`)

Common failure responses:

- `400 BAD_REQUEST` when `groupId` is not a valid app ID (`cuid` or UUID).
- `403 FORBIDDEN` when caller is not an active member.

### GET `/api/v1/groups/:groupId/members`

Purpose:

- List active members in a group.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Query params:

- `page` (optional, default `1`)
- `pageSize` (optional, default `20`, max `100`)
- `sortBy` (optional: `role`, `joinedAt`, `createdAt`; default `role`)
- `sortOrder` (optional: `asc`, `desc`; default `asc`)

Success response `200`:

- Returns `{ groupId, members[], pagination }` with each member containing:
  - `userId`, `role`, `status`, `joinedAt`, `createdAt`, `updatedAt`

Common failure responses:

- `400 BAD_REQUEST` for invalid pagination/sort query values.
- `403 FORBIDDEN` when caller is not an active member.

### PATCH `/api/v1/groups/:groupId/members/:userId/role`

Purpose:

- Update a member role (admin only).

Headers:

- `Authorization: Bearer <supabase_access_token>`

Request body:

```json
{
  "role": "ADMIN"
}
```

Validation:

- `role` must be one of `ADMIN` or `MEMBER`.

Success response `200`:

- Returns `{ groupId, userId, role, status, updatedAt }`.

Common failure responses:

- `400 BAD_REQUEST` when `groupId` is not a valid app ID (`cuid` or UUID), or `userId` is not a valid UUID.
- `400 BAD_REQUEST` when admin tries to change their own role (use leave-group flow instead).
- `403 FORBIDDEN` when caller is not admin.
- `404 NOT_FOUND` when target active member does not exist.
- `409 CONFLICT` when change would remove the last admin from the group.

### DELETE `/api/v1/groups/:groupId/members/:userId`

Purpose:

- Remove a member from group (admin only; sets member status to `INACTIVE`).

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

- Returns `{ groupId, userId, status, removed, updatedAt }`.

Common failure responses:

- `400 BAD_REQUEST` when `groupId` is not a valid app ID (`cuid` or UUID), or `userId` is not a valid UUID.
- `400 BAD_REQUEST` when admin tries to remove self via this endpoint (use leave-group flow instead).
- `403 FORBIDDEN` when caller is not admin.
- `404 NOT_FOUND` when target active member does not exist.
- `409 CONFLICT` when removal would remove the last admin from the group.

### GET `/api/v1/groups/:groupId/contract`

Purpose:

- Retrieve the current contract for a group, including the draft and the latest published content.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

```json
{
  "success": true,
  "data": {
    "contract": {
      "id": "contract-uuid",
      "groupId": "group-uuid",
      "draftContent": "Current working draft text...",
      "publishedVersion": 2,
      "updatedBy": "user-uuid",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    },
    "latestPublishedContent": "Published content from version 2..."
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Behavior notes:

- If no contract has been created yet, returns an empty contract stub (`draftContent: ""`, `publishedVersion: null`, `latestPublishedContent: null`).
- `latestPublishedContent` is `null` when no version has been published.

Common failure responses:

- `403 FORBIDDEN` when caller is not an active group member.

### PUT `/api/v1/groups/:groupId/contract`

Purpose:

- Update the contract draft content (admin only).
- Auto-creates the contract on first update (upsert).

Headers:

- `Authorization: Bearer <supabase_access_token>`

Request body:

```json
{
  "content": "Updated contract draft text..."
}
```

Validation:

- `content` is required, must be a string, max length `50000`.

Success response `200`:

```json
{
  "success": true,
  "data": {
    "id": "contract-uuid",
    "groupId": "group-uuid",
    "draftContent": "Updated contract draft text...",
    "publishedVersion": 1,
    "updatedBy": "user-uuid",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Common failure responses:

- `400 BAD_REQUEST` when `content` is missing or exceeds max length.
- `403 FORBIDDEN` when caller is not an admin.

### POST `/api/v1/groups/:groupId/contract/publish`

Purpose:

- Publish the current draft as a new immutable version (admin only).
- Increments the version counter automatically.

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `201`:

```json
{
  "success": true,
  "data": {
    "id": "version-uuid",
    "version": 3,
    "content": "Snapshot of the draft at publish time...",
    "publishedBy": "user-uuid",
    "createdAt": "ISO-8601"
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Common failure responses:

- `400 BAD_REQUEST` when draft is empty or no contract exists yet.
- `403 FORBIDDEN` when caller is not an admin.

### GET `/api/v1/groups/:groupId/contract/versions`

Purpose:

- List all published contract versions in descending order (newest first).

Headers:

- `Authorization: Bearer <supabase_access_token>`

Success response `200`:

```json
{
  "success": true,
  "data": {
    "groupId": "group-uuid",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    },
    "versions": [
      {
        "id": "version-uuid",
        "version": 2,
        "content": "Published content v2...",
        "publishedBy": "user-uuid",
        "createdAt": "ISO-8601"
      },
      {
        "id": "version-uuid",
        "version": 1,
        "content": "Published content v1...",
        "publishedBy": "user-uuid",
        "createdAt": "ISO-8601"
      }
    ]
  },
  "meta": {
    "requestId": "string",
    "timestamp": "ISO-8601"
  }
}
```

Behavior notes:

- Returns empty `versions: []` if no contract or no versions exist.

Common failure responses:

- `400 BAD_REQUEST` for invalid pagination/sort query values.
- `403 FORBIDDEN` when caller is not an active group member.

## 6) Behavior for unknown/unimplemented routes

Any unknown route currently returns wrapped `404`:

- `success: false`
- `error.code: NOT_FOUND`

Do not assume roadmap endpoints not explicitly documented in this file exist yet.

## 7) CORS and frontend origin

Current env default:

- `CORS_ORIGINS=http://localhost:5173`

If frontend runs on another origin, backend env must include it.
For multiple origins, pass comma-separated values:

- `CORS_ORIGINS=http://localhost:5173,http://localhost:3001`

Note: The backend itself runs on port `3000` by default. The CORS default points to `5173` (Vite dev server) to avoid collisions.

## 8) Supabase + backend environment assumptions

Backend is Supabase cloud-first.

Important backend env vars:

- `SUPABASE_URL`
- `SUPABASE_JWT_AUDIENCE` (currently `authenticated`)
- `DATABASE_URL` (Supabase session pooler `:5432` recommended for runtime + Prisma migrate in IPv4-only environments)

Frontend app should not use backend `DATABASE_URL`.
Frontend should only use its own safe client config (public Supabase URL + anon key) where needed.

## 8.1) Deterministic dev fixtures

Backend seed now maintains deterministic frontend fixture definitions under system settings:

- `fixtures:frontend_auth`
- `fixtures:frontend_groups`

Run:

- `pnpm prisma:seed`

Auth fixtures are auto-created/updated in Supabase Auth only when backend env has:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Fixture accounts (for frontend dev/testing):

- `roomiemanager.confirmed@gmail.com` / `StrongPass123!`
- `roomiemanager.unconfirmed@gmail.com` / `StrongPass123!`
- `roomiemanager.admin@gmail.com` / `StrongPass123!`
- `roomiemanager.member@gmail.com` / `StrongPass123!`

Note:

- `fixtures:frontend_groups` is a deterministic fixture manifest.
- Database rows for demo groups are not auto-created by seed yet; frontend can create groups through live Module 3 endpoints.

## 9) Finance endpoints (live)

Module 6 (Bills/Payments/Balances):

- `POST /api/v1/groups/:groupId/bills`
- `GET /api/v1/groups/:groupId/bills`
- `POST /api/v1/groups/:groupId/payments`
- `GET /api/v1/groups/:groupId/balances`

`GET /api/v1/groups/:groupId/bills` query params:

- `page` (optional, default `1`)
- `pageSize` (optional, default `20`, max `100`)
- `sortBy` (optional: `incurredAt`, `createdAt`, `totalAmount`; default `incurredAt`)
- `sortOrder` (optional: `asc`, `desc`; default `desc`)

`GET /api/v1/groups/:groupId/bills` response data:

- `{ groupId, bills[], pagination }`

`GET /api/v1/groups/:groupId/chores` query params:

- `status` (optional: `PENDING`, `COMPLETED`)
- `assigneeUserId` (optional)
- `dueAfter` and `dueBefore` (optional ISO timestamps)
- `page` (optional, default `1`)
- `pageSize` (optional, default `20`, max `100`)
- `sortBy` (optional: `dueDate`, `createdAt`, `updatedAt`, `status`; default `dueDate`)
- `sortOrder` (optional: `asc`, `desc`; default `asc`)

`GET /api/v1/groups/:groupId/chores` response data:

- `{ groupId, chores[], pagination }`

## 10) Path parameter validation

Path IDs are validated by the backend:

- `:groupId` and `:choreId` accept app IDs (`cuid` or UUID).
- `:userId` accepts UUID.
- Invalid IDs (for example `/api/v1/groups/not-a-uuid`) receive `400 BAD_REQUEST` immediately without hitting the database.
- Frontend should always use IDs returned by backend responses when constructing URLs.

## 11) Frontend implementation guidance (for now)

Short-term recommended approach:

1. Build one shared API client that always parses wrapped responses.
2. Centralize error normalization based on `error.code`.
3. Integrate auth + group onboarding flows now (create group, join by code, view group, reset code for admin).
4. Enable member-management, chores, and contracts screens now:
   - members list, role changes, removal
   - chore list for a group (optionally filtered by status/assignee/due date)
   - create chore, assign/unassign chore, mark chore complete
   - finance list/create flows for bills and payments
   - group balances screen using `/groups/:groupId/balances`
   - view group contract (draft + published), edit draft (admin), publish version (admin), view version history
5. Keep request/response DTOs in one contract file so swapping from mock to live is trivial.
6. Do not rely on group names preserving leading/trailing spaces; backend trims them.
7. Note that `POST /auth/register` now returns `201` and `POST /groups` returns `201` (not `200`). Handle both `2xx` status codes as success.

Example fetch wrapper:

```ts
export async function apiGet<T>(path: string): Promise<T> {
  const requestId = crypto.randomUUID();
  const res = await fetch(`http://localhost:3000/api/v1${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
  });

  const body = (await res.json()) as
    | { success: true; data: T; meta: { requestId: string; timestamp: string } }
    | {
        success: false;
        error: { code: string; message: string; details?: unknown };
        meta: { requestId: string; timestamp: string };
      };

  if (!body.success) {
    const err = new Error(body.error.message);
    (err as Error & { code?: string; requestId?: string }).code =
      body.error.code;
    (err as Error & { code?: string; requestId?: string }).requestId =
      body.meta.requestId;
    throw err;
  }

  return body.data;
}
```

## 12) Frontend QA checklist against current backend

- [ ] `/api/v1/health/live` returns `success: true` envelope.
- [ ] `/api/v1/health/ready` returns `success: true` when backend is healthy.
- [ ] `/api/v1/auth/register` returns `201` wrapped response when `SUPABASE_ANON_KEY` is configured.
- [ ] `/api/v1/auth/login` returns wrapped response with session tokens.
- [ ] `/api/v1/auth/me` returns `UNAUTHORIZED` without bearer token.
- [ ] `GET /api/v1/groups` returns `UNAUTHORIZED` without bearer token.
- [ ] `GET /api/v1/groups` returns active membership groups with `pagination` metadata in `data`.
- [ ] `GET /api/v1/groups?page=0` returns `BAD_REQUEST`.
- [ ] `POST /api/v1/groups` returns `UNAUTHORIZED` without bearer token.
- [ ] `/api/v1/groups` returns `BAD_REQUEST` for whitespace-only `name`.
- [ ] `/api/v1/groups` creates a group and returns `201` with `memberRole=ADMIN` and `joinCode`.
- [ ] `/api/v1/groups/join` joins by code and returns member context.
- [ ] `/api/v1/groups/join` returns `CONFLICT` when joining same group twice.
- [ ] `/api/v1/groups/:groupId/join-code/reset` rotates code for admin token.
- [ ] `/api/v1/groups/:groupId/join-code/reset` returns `FORBIDDEN` for non-admin/non-member caller.
- [ ] `/api/v1/groups/:groupId` returns group summary for active members.
- [ ] Member view of `/api/v1/groups/:groupId` does not include `joinCode`.
- [ ] `/api/v1/groups/:groupId/dashboard` returns aggregate cards payload for active member token.
- [ ] `/api/v1/groups/:groupId/dashboard` contains `group`, `members`, `chores`, `finance`, and `contract`.
- [ ] `/api/v1/groups/:groupId/dashboard` returns `BAD_REQUEST` for invalid `groupId`.
- [ ] `/api/v1/groups/:groupId/members` returns member list for active member token.
- [ ] `/api/v1/groups/:groupId/members` includes `pagination` metadata in `data`.
- [ ] `/api/v1/groups/:groupId/members?page=0` returns `BAD_REQUEST`.
- [ ] `PATCH /api/v1/groups/:groupId/members/:userId/role` updates role for admin token.
- [ ] `DELETE /api/v1/groups/:groupId/members/:userId` removes target member for admin token.
- [ ] Self-demotion via PATCH role returns `BAD_REQUEST`.
- [ ] Invalid `groupId` format (not `cuid`/UUID) returns `BAD_REQUEST` (not a database error).
- [ ] Last-admin demotion/removal paths return `CONFLICT`.
- [ ] Rejoined member gets `MEMBER` role (not their previous role).
- [ ] `GET /api/v1/groups/:groupId/contract` returns empty contract stub when none exists.
- [ ] `GET /api/v1/groups/:groupId/contract` returns draft + latest published content when contract exists.
- [ ] `PUT /api/v1/groups/:groupId/contract` updates draft for admin token.
- [ ] `PUT /api/v1/groups/:groupId/contract` returns `FORBIDDEN` for non-admin.
- [ ] `PUT /api/v1/groups/:groupId/contract` rejects missing `content` with `BAD_REQUEST`.
- [ ] `POST /api/v1/groups/:groupId/contract/publish` creates version and returns `201` for admin.
- [ ] `POST /api/v1/groups/:groupId/contract/publish` returns `BAD_REQUEST` when draft is empty.
- [ ] `POST /api/v1/groups/:groupId/contract/publish` returns `FORBIDDEN` for non-admin.
- [ ] `GET /api/v1/groups/:groupId/contract/versions` returns versions in descending order.
- [ ] `GET /api/v1/groups/:groupId/contract/versions` returns empty array when no versions exist.
- [ ] `GET /api/v1/groups/:groupId/contract/versions` includes `pagination` metadata in `data`.
- [ ] `GET /api/v1/groups/:groupId/contract/versions?sortBy=status` returns `BAD_REQUEST`.
- [ ] `POST /api/v1/groups/:groupId/bills` creates a bill and split rows with `201`.
- [ ] `GET /api/v1/groups/:groupId/bills` returns bill list for active members.
- [ ] `GET /api/v1/groups/:groupId/bills` includes `pagination` metadata in `data`.
- [ ] `GET /api/v1/groups/:groupId/bills?pageSize=101` returns `BAD_REQUEST`.
- [ ] `GET /api/v1/groups/:groupId/chores?sortOrder=sideways` returns `BAD_REQUEST`.
- [ ] `POST /api/v1/groups/:groupId/payments` records payment with `201`.
- [ ] `GET /api/v1/groups/:groupId/balances` returns deterministic `settlements` and `memberBalances`.
- [ ] Unknown endpoint returns wrapped `NOT_FOUND` error.
- [ ] Sent `x-request-id` is echoed back in response header + `meta.requestId`.
- [ ] UI error boundary can display backend `error.code` and `meta.requestId`.

## 13) Changelog notes for frontend team

2026-03-05:

- **Breaking change**: `POST /api/v1/auth/register` now returns `201 Created` (was `200`).
- **Breaking change**: `POST /api/v1/groups` now returns `201 Created` (was `200`).
- **Breaking change**: Default `CORS_ORIGINS` changed from `http://localhost:3000` to `http://localhost:5173`.
- **New behavior**: Route IDs are now strictly validated (`groupId`/`choreId`: `cuid` or UUID, `userId`: UUID). Invalid formats return `400 BAD_REQUEST` immediately.
- **New behavior**: `PATCH role` endpoint now blocks self-demotion (`400 BAD_REQUEST`).
- **New behavior**: Rejoining a group always resets role to `MEMBER`.
- **New validation**: Password fields now enforce `maxLength: 128`.
- **New endpoints (Module 5)**:
  - `POST /api/v1/groups/:groupId/chores` — create chore
  - `GET /api/v1/groups/:groupId/chores` — list/filter chores by status, assignee, due date
  - `PATCH /api/v1/chores/:choreId/assign` — assign/unassign chore (admins can assign to others; members can assign to themselves)
  - `PATCH /api/v1/chores/:choreId/complete` — mark chore complete (admins or assignee)
- **Security**: Error responses no longer leak internal details (Prisma column names, Supabase error codes, raw error messages). Error `details` field may be absent or contain only safe information.
- **Security**: Health readiness failure response no longer includes raw database error messages.
- **Schema**: `JoinCode` model now has an `expiresAt` column (not yet enforced in application logic).
- **Schema**: New indexes on `Group.createdBy`, `GroupAuditLog.targetUserId`, `GroupAuditLog.createdAt`.
- **New endpoints (Module 7)**:
  - `GET /api/v1/groups/:groupId/contract` — view contract (draft + latest published content)
  - `PUT /api/v1/groups/:groupId/contract` — update draft (admin only, upserts on first write)
  - `POST /api/v1/groups/:groupId/contract/publish` — publish draft as new immutable version (admin only, returns `201`)
  - `GET /api/v1/groups/:groupId/contract/versions` — list all published versions (newest first)
- **New endpoints (Module 6)**:
  - `POST /api/v1/groups/:groupId/bills` — create bill with split rows
  - `GET /api/v1/groups/:groupId/bills` — list group bills
  - `POST /api/v1/groups/:groupId/payments` — record payment (supports optional `idempotencyKey`)
  - `GET /api/v1/groups/:groupId/balances` — return net balances and who-owes-whom settlements
- **New endpoint (Module 8)**: `GET /api/v1/groups` for current-user active group listing (pagination + sorting + role-aware join code visibility).
- **New endpoint (Module 8)**: `GET /api/v1/groups/:groupId/dashboard` for group dashboard aggregation payload (`group`, `members`, `chores`, `finance`, `contract`).
- **API UX update (Module 8)**: list endpoints now use consistent pagination/sort query conventions and include `pagination` metadata in response data (`groups`, `members`, `chores`, `contract/versions`, `bills`).
- **API UX update (Module 8)**: Swagger/OpenAPI now includes concrete success examples for core + list + aggregate flows (auth/group/member/chores/contracts/bills/payments/balances/health) plus explicit validation/authorization response docs.
- **Quality gate update**: `openapi:check` now enforces semantic core + list + aggregate endpoint contract assertions (auth/public posture, required response codes, required path/query params, request-body presence where expected, required operation summary/tags, list query constraints, success-envelope example shape checks, and core endpoint required data keys), in addition to file drift checks.
- **Frontend contract update**: generated backend API TypeScript types are published at `/Users/admin/Documents/GitHub/RoomieManager/frontend/generated/backend-api.types.ts` and checked in CI via `openapi:types:check`.
- **Testing update**: new invalid-query e2e coverage added for list endpoints (`page/pageSize/sortBy/sortOrder` validation paths).
- **Testing update**: dashboard endpoint coverage added in unit + e2e tests.
- **Testing update**: response-envelope contract e2e suite added for key routes (`test/response-envelope-contract.e2e-spec.ts`).
- **Testing update**: optional live deep-journey suite added (`test/live-user-journey.e2e-spec.ts`) for production-like multi-module flow validation.
- Migrations `20260305192502_0004_hardening_indexes_join_code_expiry`, `20260305193953_0005_module5_chores`, `20260305195941_0006_module7_contracts`, and `20260305213000_0007_module6_finance` deployed on Supabase.
- `pnpm verify` pipeline passes end-to-end (54 unit + 57 e2e tests; 2 optional live suites).

2026-02-25:

- Full backend regression audit re-passed end-to-end:
  - `pnpm install --frozen-lockfile`
  - `pnpm verify`
  - `pnpm test:cov`
  - production-mode startup + health/readiness checks
  - live auth/groups/module4 RBAC simulation + DB sanity validation
- No runtime regressions found in currently shipped endpoints.

2026-02-24:

- Module 4 migration deployed on Supabase (`0003_module4_member_management_rbac`).
- Module 4 endpoints validated with live register/login/create/join/member-role/remove smoke flow.
- Last-admin and self-removal edge cases verified (`CONFLICT`/`BAD_REQUEST` as expected).
- Supabase connection guidance updated to session-pooler (`:5432`) for stable Prisma migrate/verify in IPv4-only environments.

2026-02-23:

- Backend Module 1 completed.
- Module 2 auth endpoints implemented (`register`, `login`, `me`) and verified.
- Module 3 group endpoints implemented (`create`, `join`, `reset join code`, `get group`) and verified.
- Supabase cloud-first setup adopted.
- Global response/error envelope finalized and live.
- Health endpoints fully implemented and tested.
- OpenAPI contract drift check added to verification pipeline.
- Group-name whitespace validation bug fixed (whitespace-only now rejected).
- Logging hardened: sensitive auth headers/fields are redacted.
- Extended live edge-case audit passed against Supabase-backed runtime.
- Module 4 member-management endpoints implemented in backend code with RBAC + last-admin protection + audit logging.
- `pnpm start` now runs from compiled `dist/src/main.js`.
