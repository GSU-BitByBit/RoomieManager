# RoomieManager Backend on OCI with Docker, Caddy, and GitHub Actions

This is the recommended production model for RoomieManager:

- frontend stays on Vercel
- backend stays on the OCI VM
- the NestJS backend runs in Docker
- host-level Caddy keeps terminating HTTPS
- GitHub Actions builds and ships the backend automatically on pushes to `main`
- Supabase remains the source of truth for Postgres and Auth

Keeping Caddy on the host is deliberate. It preserves the live TLS setup that already works today while moving the backend process itself into a reproducible Docker runtime.

## Runtime layout

- Runtime root on OCI: `/srv/roomiemanager/backend`
- Docker compose file: `/srv/roomiemanager/backend/deploy/docker/docker-compose.prod.yml`
- Deploy helper script: `/srv/roomiemanager/backend/deploy/scripts/oci-deploy.sh`
- App env file: `/etc/roomiemanager/backend.env`
- Compose env file: `/etc/roomiemanager/compose.env`
- systemd unit: `/etc/systemd/system/roomiemanager-backend-docker.service`
- Caddy config: `/etc/caddy/Caddyfile`

## One-time OCI bootstrap

1. Install runtime packages:
   - `sudo apt-get update`
   - `sudo apt-get install -y docker.io docker-compose-plugin caddy rsync`
2. Allow the deploy user to run Docker:
   - `sudo usermod -aG docker ubuntu`
   - sign out and back in before continuing
3. Create runtime directories:
   - `sudo mkdir -p /srv/roomiemanager/backend/deploy`
   - `sudo mkdir -p /etc/roomiemanager`
   - `sudo chown -R ubuntu:ubuntu /srv/roomiemanager/backend`
4. Copy the repo deployment assets into `/srv/roomiemanager/backend/deploy/`.
5. Create `/etc/roomiemanager/backend.env` from [`deploy/docker/backend.env.example`](../deploy/docker/backend.env.example).
6. Create `/etc/roomiemanager/compose.env` from [`deploy/docker/compose.env.example`](../deploy/docker/compose.env.example).
7. Install the Docker systemd unit from [`deploy/systemd/roomiemanager-backend-docker.service`](../deploy/systemd/roomiemanager-backend-docker.service).
8. Install the host Caddy config from [`deploy/caddy/Caddyfile.example`](../deploy/caddy/Caddyfile.example).
9. Enable services:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now docker`
   - `sudo systemctl enable --now roomiemanager-backend-docker`
   - `sudo systemctl enable --now caddy`

## Compose env file

`/etc/roomiemanager/compose.env` should contain:

- `ROOMIEMANAGER_IMAGE=ghcr.io/<github-owner>/roomiemanager-backend:main`
- `BACKEND_BIND_HOST=127.0.0.1`
- `BACKEND_HOST_PORT=3000`

For the first migration from the current systemd-based Node process, you can temporarily use `BACKEND_HOST_PORT=3001`, verify the container locally, then point Caddy to `127.0.0.1:3001` for the cutover.

## App env file

`/etc/roomiemanager/backend.env` should contain the production Nest/Supabase variables. The Docker-specific example already sets:

- `HOST=0.0.0.0`
- `PORT=3000`
- `SUPABASE_AUTH_REDIRECT_URL=https://roomiemanager.site/auth/callback`
- `RUN_MIGRATIONS_ON_START=true`

## Caddy

Caddy stays on the host VM and reverse-proxies the Dockerized backend over localhost. This keeps certificate management stable and limits the blast radius of the migration.

Expected upstream:

- `reverse_proxy 127.0.0.1:3000`

If you use the safer first-cutover path, point Caddy to `127.0.0.1:3001` until the legacy process is retired.

## GitHub Actions deployment flow

On pushes to `main` that affect the backend:

1. GitHub Actions runs the backend verify job.
2. If verify passes, Actions builds the Docker image from [`backend/Dockerfile`](../Dockerfile).
3. The image is pushed to GHCR with a rolling `main` tag and a commit-specific `sha-*` tag.
4. Actions syncs the deployment assets under `backend/deploy/` to the OCI VM.
5. Actions runs [`deploy/scripts/oci-deploy.sh`](../deploy/scripts/oci-deploy.sh) over SSH.
6. The OCI script pulls the latest image, starts the backend container, and blocks until `/api/v1/health/ready` passes.

## GitHub Actions secrets

Repository secrets required by the workflow:

- `SUPABASE_DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_AUDIENCE`
- `OCI_DEPLOY_HOST`
- `OCI_DEPLOY_USER`
- `OCI_DEPLOY_SSH_KEY`

The deploy job does not need Docker build secrets beyond the default GitHub Actions token because the image is published to GHCR from the workflow itself.

## Supabase email and SMTP configuration

The application now supports:

- signup confirmation that returns to `roomiemanager.site`
- password recovery emails that return to `roomiemanager.site`
- reset-password completion inside the web app
- email-link callback handling for both session-fragment links and token-hash exchange links

To finish the production setup, configure the Supabase dashboard:

1. In Auth URL configuration:
   - set Site URL to `https://roomiemanager.site/auth/callback`
   - allow `https://roomiemanager.site/auth/callback`
   - allow `https://www.roomiemanager.site/auth/callback`
   - optionally allow `http://localhost:5173/auth/callback` for local development
2. In Auth Providers → Email:
   - keep email confirmations enabled
   - configure your custom SMTP host, port, username, password, sender name, and sender email
3. In the backend runtime env:
   - set `SUPABASE_AUTH_REDIRECT_URL=https://roomiemanager.site/auth/callback`

If you customize the Supabase email templates later, prefer `{{ .RedirectTo }}` over hard-coded site URLs so the backend-supplied redirect stays consistent across environments.

## Rollback

Rollback is intentionally simple:

1. Edit `/etc/roomiemanager/compose.env`
2. Change `ROOMIEMANAGER_IMAGE` from `:main` to the last known-good `:sha-...` tag
3. Run:
   - `docker compose --env-file /etc/roomiemanager/compose.env -f /srv/roomiemanager/backend/deploy/docker/docker-compose.prod.yml pull backend`
   - `docker compose --env-file /etc/roomiemanager/compose.env -f /srv/roomiemanager/backend/deploy/docker/docker-compose.prod.yml up -d backend`

## Verification checklist

- `docker compose --env-file /etc/roomiemanager/compose.env -f /srv/roomiemanager/backend/deploy/docker/docker-compose.prod.yml ps`
- `docker compose --env-file /etc/roomiemanager/compose.env -f /srv/roomiemanager/backend/deploy/docker/docker-compose.prod.yml logs --tail=100 backend`
- `curl http://127.0.0.1:3000/api/v1/health/live`
- `curl http://127.0.0.1:3000/api/v1/health/ready`
- `curl https://api.roomiemanager.site/api/v1/health/live`
- `curl https://api.roomiemanager.site/api/v1/health/ready`
