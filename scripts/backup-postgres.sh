#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
SERVICE_NAME="${POSTGRES_SERVICE:-db}"
DB_NAME="${POSTGRES_DB:-perez_martin}"
DB_USER="${POSTGRES_USER:-perez}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
docker compose exec -T "$SERVICE_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

if [ ! -s "$FILE" ]; then
  echo "Backup fallido: archivo vacío" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +30 -delete
echo "Backup exitoso: $FILE"
