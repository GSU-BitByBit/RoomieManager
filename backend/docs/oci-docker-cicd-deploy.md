# OCI Docker + CI/CD Deployment

This document captures the current production deployment model for RoomieManager's backend.

## Current Production State

- Frontend: Vercel at `https://roomiemanager.site`.
- Backend API: OCI VM at `https://api.roomiemanager.site/api/v1`.
- Reverse proxy: Caddy terminates HTTPS and proxies to the Docker backend.
- Backend runtime: Docker Compose, bound to `127.0.0.1:3001`.
- Image source: GHCR image built by GitHub Actions from `main`.
- Database/Auth: Supabase Postgres and Supabase Auth.
- Email: Supabase Auth SMTP configured with Resend for verification and password recovery.
- Legacy host-process backend: retired after the Docker cutover and no longer serving public traffic.

## Runtime Paths On OCI

```text
/srv/roomiemanager/backend/deploy/        # synced deployment assets
/etc/roomiemanager/backend.env            # production backend env
/etc/roomiemanager/compose.env            # image tag and host binding env
/etc/systemd/system/roomiemanager-backend-docker.service
/etc/caddy/Caddyfile
```

The Docker service should be the backend process that stays enabled:

```bash
sudo systemctl status roomiemanager-backend-docker
sudo docker ps --filter name=roomiemanager-backend
```

## Docker Compose Model

The container listens on internal port `3000`. The host binds it to localhost port `3001` so Caddy can proxy to it without exposing the Node process directly.

`/etc/roomiemanager/compose.env` should look like:

```bash
ROOMIEMANAGER_IMAGE=ghcr.io/<owner>/roomiemanager-backend:main
BACKEND_BIND_HOST=127.0.0.1
BACKEND_HOST_PORT=3001
```

`/etc/roomiemanager/backend.env` should include production values for:

- `NODE_ENV=production`
- `PORT=3000`
- `API_PREFIX=api/v1`
- `DATABASE_URL`
- `CORS_ORIGINS=https://roomiemanager.site,https://www.roomiemanager.site`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_AUDIENCE=authenticated`
- `SUPABASE_AUTH_REDIRECT_URL=https://roomiemanager.site/auth/callback`
- `RUN_MIGRATIONS_ON_START=true`

Do not commit production secrets.

## Caddy Runtime

Production Caddy should proxy the API domain to Docker:

```caddy
api.roomiemanager.site {
  encode zstd gzip

  header {
    -Server
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "camera=(), geolocation=(), microphone=()"
  }

  reverse_proxy 127.0.0.1:3001
}
```

Validate and reload safely:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## GitHub Actions Pipeline

[`../../.github/workflows/backend-ci.yml`](../../.github/workflows/backend-ci.yml) performs three production steps on pushes to `main`:

1. Verify backend quality with pnpm, Prisma, linting, tests, build, OpenAPI, and generated type checks.
2. Build and publish the backend Docker image to GHCR.
3. SSH into OCI, sync deploy assets, run the deployment script, and verify public readiness.

Required GitHub secrets:

- `SUPABASE_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_AUDIENCE`
- `OCI_DEPLOY_HOST`
- `OCI_DEPLOY_USER`
- `OCI_DEPLOY_SSH_KEY`

GHCR visibility is public for the backend image, so the OCI VM does not need a registry login to pull the production image.

## Supabase Auth + Resend SMTP

Supabase Auth is configured for production email verification and password recovery:

- Site URL: `https://roomiemanager.site/auth/callback`
- Redirect URLs:
  - `https://roomiemanager.site/auth/callback`
  - `http://localhost:5173/auth/callback`
  - `http://127.0.0.1:5173/auth/callback`
- SMTP host: `smtp.resend.com`
- SMTP port: `465`
- SMTP user: `resend`
- Sender email: `no-reply@roomiemanager.site`
- Sender name: `RoomieManager`
- Email autoconfirm: disabled
- Unverified email sign-ins: disabled

The branded confirmation email source lives in [`email-templates/`](email-templates/). Keep the Supabase template placeholders intact, especially `{{ .ConfirmationURL }}`.

## Health Verification

Local on OCI:

```bash
curl http://127.0.0.1:3001/api/v1/health/live
curl http://127.0.0.1:3001/api/v1/health/ready
```

Public:

```bash
curl https://api.roomiemanager.site/api/v1/health/live
curl https://api.roomiemanager.site/api/v1/health/ready
```

Auth endpoint exposure:

```bash
curl --request POST \
  https://api.roomiemanager.site/api/v1/auth/password/recovery \
  --header 'Content-Type: application/json' \
  --data '{"email":"not-an-email"}'
```

The expected response for the invalid email payload is a wrapped `BAD_REQUEST`, not a `404`. That proves public traffic is on the auth-enabled Docker backend.

## Rollback Notes

Preferred rollback is image-based:

1. Set `ROOMIEMANAGER_IMAGE` in `/etc/roomiemanager/compose.env` to a known-good GHCR tag, such as a previous `sha-...` image.
2. Restart `roomiemanager-backend-docker`.
3. Verify localhost health on `127.0.0.1:3001`.
4. Verify public health through Caddy.

Emergency legacy rollback should only be used if the old host-process runtime is intentionally kept available on the VM:

1. Start the legacy service.
2. Change Caddy upstream back to `127.0.0.1:3000`.
3. Validate and reload Caddy.
4. Verify public health.

Do not delete Docker assets, Caddy config, or production env files during rollback.
