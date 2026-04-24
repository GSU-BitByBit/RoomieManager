#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/roomiemanager/backend}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_ROOT/deploy/docker/docker-compose.prod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-/etc/roomiemanager/compose.env}"
APP_ENV_FILE="${APP_ENV_FILE:-/etc/roomiemanager/backend.env}"
SERVICE_NAME="${SERVICE_NAME:-backend}"
HEALTHCHECK_PATH="${HEALTHCHECK_PATH:-/api/v1/health/ready}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-30}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-5}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_ENV_FILE" ]]; then
  echo "Missing compose env file: $COMPOSE_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$APP_ENV_FILE" ]]; then
  echo "Missing app env file: $APP_ENV_FILE" >&2
  exit 1
fi

APP_HOST="$(grep -E '^HOST=' "$APP_ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
if [[ -z "$APP_HOST" || "$APP_HOST" == "127.0.0.1" || "$APP_HOST" == "localhost" ]]; then
  echo "Docker backend HOST must be reachable through the container port mapping." >&2
  echo "Set HOST=0.0.0.0 in $APP_ENV_FILE before deploying." >&2
  exit 1
fi

set -a
source "$COMPOSE_ENV_FILE"
set +a

BACKEND_BIND_HOST="${BACKEND_BIND_HOST:-127.0.0.1}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-3000}"
HEALTHCHECK_URL="http://${BACKEND_BIND_HOST}:${BACKEND_HOST_PORT}${HEALTHCHECK_PATH}"

echo "Pulling latest backend image..."
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" pull "$SERVICE_NAME"

echo "Starting backend container..."
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"

echo "Waiting for readiness at $HEALTHCHECK_URL"
for ((attempt = 1; attempt <= HEALTHCHECK_ATTEMPTS; attempt += 1)); do
  if curl --fail --silent --show-error "$HEALTHCHECK_URL" >/dev/null; then
    echo "Backend is ready."
    exit 0
  fi

  sleep "$HEALTHCHECK_SLEEP_SECONDS"
done

echo "Backend failed readiness check. Recent container logs:" >&2
docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" logs --tail=200 "$SERVICE_NAME" >&2
exit 1
