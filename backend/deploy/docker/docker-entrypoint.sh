#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "Running Prisma migrations..."
  pnpm prisma:migrate:deploy
fi

exec "$@"
