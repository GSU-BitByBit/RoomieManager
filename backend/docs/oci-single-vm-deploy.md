# RoomieManager Backend on OCI

This backend is designed to run on a single Ubuntu VM behind Caddy:

- NestJS listens on `127.0.0.1:3000`
- Caddy terminates HTTPS on `https://api.<your-domain>`
- systemd keeps the backend alive
- Supabase remains the source of truth for Postgres and Auth

## Runtime layout

- App directory: `/srv/roomiemanager/backend`
- Environment file: `/etc/roomiemanager/backend.env`
- systemd unit: `/etc/systemd/system/roomiemanager-backend.service`
- Caddy config: `/etc/caddy/Caddyfile`

## Required environment variables

Use [`deploy/env/backend.env.example`](../deploy/env/backend.env.example) as the template.

Minimum production values:

- `NODE_ENV=production`
- `HOST=127.0.0.1`
- `PORT=3000`
- `API_PREFIX=api/v1`
- `DATABASE_URL=<Supabase pooled Postgres URL>`
- `CORS_ORIGINS=<comma-separated frontend origins>`
- `SUPABASE_URL=<your Supabase project URL>`
- `SUPABASE_ANON_KEY=<your Supabase anon key>`
- `SUPABASE_JWT_AUDIENCE=authenticated`

`SUPABASE_SERVICE_ROLE_KEY` is currently not required by this backend runtime, but the template keeps it available in case the app grows into admin Supabase calls later.

## Expected health checks

- Liveness: `/api/v1/health/live`
- Readiness: `/api/v1/health/ready`

## Deployment flow on the VM

1. Install Node.js 22, `pnpm`, Git, and Caddy.
2. Clone the repo to `/srv/roomiemanager`.
3. Copy `deploy/env/backend.env.example` to `/etc/roomiemanager/backend.env` and fill in real values.
4. Run:
   - `pnpm install --frozen-lockfile`
   - `pnpm prisma generate`
   - `pnpm prisma:migrate:deploy`
   - `pnpm build`
5. Install the systemd unit from [`deploy/systemd/roomiemanager-backend.service`](../deploy/systemd/roomiemanager-backend.service).
6. Install the Caddy config from [`deploy/caddy/Caddyfile.example`](../deploy/caddy/Caddyfile.example) and replace `api.example.com`.
7. Enable and start both services:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now roomiemanager-backend`
   - `sudo systemctl enable --now caddy`

## Verification checklist

- `curl http://127.0.0.1:3000/api/v1/health/live`
- `curl http://127.0.0.1:3000/api/v1/health/ready`
- `sudo systemctl status roomiemanager-backend`
- `sudo journalctl -u roomiemanager-backend -n 100 --no-pager`
- `curl https://api.<your-domain>/api/v1/health/live`
- `curl https://api.<your-domain>/api/v1/health/ready`

## App API base URLs

- Web app: `https://api.<your-domain>/api/v1`
- Flutter app: `--dart-define=ROOMIE_API_BASE_URL=https://api.<your-domain>/api/v1`
