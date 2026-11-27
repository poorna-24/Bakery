#!/usr/bin/env bash
# Brings the server up to date with GitHub's main branch: rebuilds the app,
# applies any new database tables or columns, and restarts what changed.
# Run by the "Deploy to Oracle" GitHub workflow after every merge to main,
# or by hand on the server:   ~/Bakery/deploy/oracle/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
compose() { docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml "$@"; }

if [ ! -f .env ]; then
  echo "No .env here yet — create it from deploy/oracle/env.example first." >&2
  exit 1
fi

echo "==> Fetching main"
git fetch --quiet origin main
# The server never carries changes of its own; .env is ignored by git and kept.
git reset --quiet --hard origin/main

echo "==> Building"
compose --profile setup build

echo "==> Updating the database"
# Adds new tables and columns. Prisma refuses any change that would delete
# data, so a bad release cannot quietly drop the menu.
compose --profile setup run --rm migrate

echo "==> Starting"
compose up -d --remove-orphans
docker image prune -f >/dev/null

echo "==> Deployed $(git log -1 --format='%h %s')"
