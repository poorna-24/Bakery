#!/usr/bin/env bash
# One-off move from Supabase: copies the menu, settings and orders into this
# server's own database. Run once, on the server, before customers use it:
#
#   SUPABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' \
#     ~/Bakery/deploy/oracle/import-from-supabase.sh
#
# Use Supabase's session pooler address (port 5432). Supabase is only read.
set -euo pipefail

: "${SUPABASE_URL:?Set SUPABASE_URL to the Supabase session pooler connection string, port 5432.}"

cd "$(dirname "$0")/../.."
compose() { docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml "$@"; }
sql() { compose exec -T db psql -v ON_ERROR_STOP=1 -U bakery -d bakery "$@"; }

echo "==> Making sure this server's tables exist"
compose up -d db
compose --profile setup run --rm migrate

items=$(sql -tA -c 'SELECT count(*) FROM "Item"')
if [ "$items" != "0" ] && [ "${FORCE:-}" != "1" ]; then
  echo "This server's database already has $items items; importing again would duplicate them." >&2
  echo "Run with FORCE=1 to empty it and import afresh." >&2
  exit 1
fi

echo "==> Copying from Supabase"
sql -q -c 'TRUNCATE "OrderLine", "Order", "ItemVariant", "Item", "Category", "Setting" CASCADE'
# --disable-triggers lets the rows load in any order without tripping the
# links between tables; they are all consistent again once the copy is done.
docker run --rm postgres:17-alpine \
  pg_dump "$SUPABASE_URL" --data-only --disable-triggers --no-owner --no-privileges \
    --table='public."Category"' --table='public."Item"' --table='public."ItemVariant"' \
    --table='public."Setting"' --table='public."Order"' --table='public."OrderLine"' \
  | sql -q

categories=$(sql -tA -c 'SELECT count(*) FROM "Category"')
items=$(sql -tA -c 'SELECT count(*) FROM "Item"')
orders=$(sql -tA -c 'SELECT count(*) FROM "Order"')
echo "==> Imported $categories categories, $items items and $orders orders."
