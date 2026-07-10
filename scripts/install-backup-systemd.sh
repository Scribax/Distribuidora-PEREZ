#!/usr/bin/env sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SERVICE_FILE="/etc/systemd/system/perez-backup.service"
TIMER_FILE="/etc/systemd/system/perez-backup.timer"
ENV_FILE="/etc/perez-backup.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutá este script como root." >&2
  exit 1
fi

sed "s#WorkingDirectory=/root/Distribuidora-PEREZ#WorkingDirectory=$PROJECT_DIR#g; s#PROJECT_DIR=/root/Distribuidora-PEREZ#PROJECT_DIR=$PROJECT_DIR#g; s#ExecStart=/root/Distribuidora-PEREZ#ExecStart=$PROJECT_DIR#g" \
  "$PROJECT_DIR/infra/systemd/perez-backup.service" > "$SERVICE_FILE"
cp "$PROJECT_DIR/infra/systemd/perez-backup.timer" "$TIMER_FILE"

chmod +x "$PROJECT_DIR/scripts/backup-postgres.sh"
mkdir -p /var/backups/perez
chmod 700 /var/backups/perez
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
# Opcional: destino remoto rclone para copiar backups fuera del VPS.
# Ejemplos:
# BACKUP_REMOTE="perezdrive:Distribuidora-PEREZ/backups"
# BACKUP_REMOTE="perezr2:perez-backups"
# BACKUP_REMOTE_RETENTION_DAYS=30
EOF
fi
chmod 600 "$ENV_FILE"

systemctl daemon-reload
systemctl enable --now perez-backup.timer
systemctl start perez-backup.service
systemctl status perez-backup.timer --no-pager
echo "Backups instalados. Último backup:"
ls -lh /var/backups/perez | tail -n 5
