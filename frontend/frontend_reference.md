# Frontend Integration Reference (RoomieManager Backend)

Last updated: 2026-02-23
Owner: Backend team
Scope: Practical integration guide for frontend engineers and frontend AI agents.

## 1) What exists right now

Current backend implementation level:
- Module 1 (Platform Foundation): COMPLETE
- Module 2 (Authentication and Identity): COMPLETE (register/login require `SUPABASE_ANON_KEY`)
- Module 3 (Groups and Join Codes): COMPLETE
- Modules 4-7, 9: NOT_STARTED
- Modules 8, 10, 11: PARTIAL foundations only

This means:
- Implemented API endpoints right now: health + auth + groups.
- Member-management/RBAC, chores, bills, and contracts endpoints are still planned.

Source-of-truth files:
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/main.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/response.interceptor.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/http-exception.filter.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/common/http/http-error-code.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/health/health.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/health/health.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/auth.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/auth.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/auth/guards/supabase-jwt-auth.guard.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/groups.controller.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/groups.service.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/modules/groups/dto/create-group.dto.ts`
- `/Users/admin/Documents/GitHub/RoomieManager/backend/src/app.module.ts`
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
      | 'BAD_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'INTERNAL_ERROR'
      | 'SERVICE_UNAVAILABLE';
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

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
      },
      "details": {
        "database": "db down"
      }
    }
  },
  "meta": {
    "requestId": "external-request-id",
    "timestamp": "2026-02-23T20:51:54.827Z"
  }
}
```

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

Success response `200`:

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

Success response `200`:

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

## 6) Behavior for unknown/unimplemented routes

Any unknown route currently returns wrapped `404`:
- `success: false`
- `error.code: NOT_FOUND`

Do not assume planned endpoints exist yet.

## 7) CORS and frontend origin

Current env default:
- `CORS_ORIGINS=http://localhost:3000`

If frontend runs on another origin, backend env must include it.
For multiple origins, pass comma-separated values:
- `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`

## 8) Supabase + backend environment assumptions

Backend is Supabase cloud-first.

Important backend env vars:
- `SUPABASE_URL`
- `SUPABASE_JWT_AUDIENCE` (currently `authenticated`)
- `DATABASE_URL` (direct URL preferred for migrations; `sslmode=require`)

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

## 9) Planned endpoints (not live yet)

These are roadmap endpoints from backend planning and should be treated as planned contracts.

Module 4 (Members/RBAC):
- `GET /api/v1/groups/:groupId/members`
- `PATCH /api/v1/groups/:groupId/members/:userId/role`
- `DELETE /api/v1/groups/:groupId/members/:userId`

Module 5 (Chores):
- `POST /api/v1/groups/:groupId/chores`
- `GET /api/v1/groups/:groupId/chores`
- `PATCH /api/v1/chores/:choreId/assign`
- `PATCH /api/v1/chores/:choreId/complete`

Module 6 (Bills/Payments/Balances):
- `POST /api/v1/groups/:groupId/bills`
- `GET /api/v1/groups/:groupId/bills`
- `POST /api/v1/groups/:groupId/payments`
- `GET /api/v1/groups/:groupId/balances`

Module 7 (Contracts):
- `GET /api/v1/groups/:groupId/contract`
- `PUT /api/v1/groups/:groupId/contract`
- `POST /api/v1/groups/:groupId/contract/publish`
- `GET /api/v1/groups/:groupId/contract/versions`

## 10) Frontend implementation guidance (for now)

Short-term recommended approach:
1. Build one shared API client that always parses wrapped responses.
2. Centralize error normalization based on `error.code`.
3. Integrate auth + group onboarding flows now (create group, join by code, view group, reset code for admin).
4. Gate Module 4+ screens (member management, chores, bills, contracts) behind mocks until those APIs ship.
5. Keep request/response DTOs in one contract file so swapping from mock to live is trivial.
6. Do not rely on group names preserving leading/trailing spaces; backend trims them.

Example fetch wrapper:

```ts
export async function apiGet<T>(path: string): Promise<T> {
  const requestId = crypto.randomUUID();
  const res = await fetch(`http://localhost:3000/api/v1${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId
    }
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
    (err as Error & { code?: string; requestId?: string }).code = body.error.code;
    (err as Error & { code?: string; requestId?: string }).requestId = body.meta.requestId;
    throw err;
  }

  return body.data;
}
```

## 11) Frontend QA checklist against current backend

- [ ] `/api/v1/health/live` returns `success: true` envelope.
- [ ] `/api/v1/health/ready` returns `success: true` when backend is healthy.
- [ ] `/api/v1/auth/register` returns wrapped response when `SUPABASE_ANON_KEY` is configured.
- [ ] `/api/v1/auth/login` returns wrapped response with session tokens.
- [ ] `/api/v1/auth/me` returns `UNAUTHORIZED` without bearer token.
- [ ] `/api/v1/groups` returns `UNAUTHORIZED` without bearer token.
- [ ] `/api/v1/groups` returns `BAD_REQUEST` for whitespace-only `name`.
- [ ] `/api/v1/groups` creates a group and returns `memberRole=ADMIN` with `joinCode`.
- [ ] `/api/v1/groups/join` joins by code and returns member context.
- [ ] `/api/v1/groups/join` returns `CONFLICT` when joining same group twice.
- [ ] `/api/v1/groups/:groupId/join-code/reset` rotates code for admin token.
- [ ] `/api/v1/groups/:groupId/join-code/reset` returns `FORBIDDEN` for non-admin/non-member caller.
- [ ] `/api/v1/groups/:groupId` returns group summary for active members.
- [ ] Member view of `/api/v1/groups/:groupId` does not include `joinCode`.
- [ ] Unknown endpoint returns wrapped `NOT_FOUND` error.
- [ ] Sent `x-request-id` is echoed back in response header + `meta.requestId`.
- [ ] UI error boundary can display backend `error.code` and `meta.requestId`.

## 12) Changelog notes for frontend team

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
- `pnpm start` now runs from compiled `dist/src/main.js`.
