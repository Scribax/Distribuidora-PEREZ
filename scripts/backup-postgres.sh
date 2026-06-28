#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/perez}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
SERVICE_NAME="${POSTGRES_SERVICE:-db}"
DB_NAME="${POSTGRES_DB:-perez_martin}"
DB_USER="${POSTGRES_USER:-perez}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
LOCK_DIR="/tmp/perez-backup.lock"

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Backup ya en ejecución; saliendo." >&2
  exit 1
fi

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

tmp_file="${FILE}.tmp"
docker compose exec -T "$SERVICE_NAME" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" | gzip -9 > "$tmp_file"

if [ ! -s "$tmp_file" ]; then
  rm -f "$tmp_file"
  echo "Backup fallido: archivo vacío" >&2
  exit 1
fi

if ! gzip -t "$tmp_file"; then
  rm -f "$tmp_file"
  echo "Backup fallido: gzip inválido" >&2
  exit 1
fi

mv "$tmp_file" "$FILE"
chmod 600 "$FILE"
ln -sfn "$FILE" "$BACKUP_DIR/latest.sql.gz"

find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

echo "Backup exitoso: $FILE"
