#!/usr/bin/env bash
# Nightly copy of the whole database, kept for 14 days. setup.sh schedules it.
# Run by hand any time:   ~/Bakery/deploy/oracle/backup.sh
#
# The copies live on the same server — enough to undo a mistake. To survive
# losing the server too, copy ~/bakery-backups somewhere else now and then
# (deploy/oracle/README.md shows how).
#
# Restore one with:
#   gunzip -c ~/bakery-backups/bakery-2026-11-27.sql.gz | \
#     docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml exec -T db psql -U bakery -d bakery
set -euo pipefail

cd "$(dirname "$0")/../.."
dir="$HOME/bakery-backups"
mkdir -p "$dir"

file="$dir/bakery-$(date +%F).sql.gz"
docker compose -f docker-compose.yml -f deploy/oracle/docker-compose.oracle.yml \
  exec -T db pg_dump -U bakery -d bakery --clean --if-exists | gzip > "$file.part"
mv "$file.part" "$file"

find "$dir" -name 'bakery-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') backed up $(du -h "$file" | cut -f1) to $file"
