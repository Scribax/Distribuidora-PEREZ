#!/usr/bin/env bash
#
# Deploy de Distribuidora PEREZ en el VPS.
#
# Qué hace, en orden seguro:
#   1. Trae el último código de origin/main.
#   2. Reconstruye las imágenes de API y Web.
#   3. Levanta la base de datos y espera a que acepte conexiones.
#   4. Aplica las migraciones de Prisma ANTES de levantar la API nueva
#      (el código nuevo puede depender de tablas que la migración crea).
#   5. Recrea API y Web con las imágenes nuevas.
#   6. Limpia imágenes viejas colgadas.
#
# Uso (desde la raíz del repo en el VPS):
#   ./scripts/deploy.sh
#
# Requisitos: docker, docker compose, git, y un .env de producción presente.

set -euo pipefail

# --- Ubicarse siempre en la raíz del repo, sin importar desde dónde se invoque ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Salida con color (se degrada a texto plano si no hay TTY) ---
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"; RED="$(printf '\033[31m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi
log()  { echo "${BOLD}${GREEN}==>${RESET} ${BOLD}$*${RESET}"; }
warn() { echo "${BOLD}${YELLOW}==>${RESET} $*"; }
die()  { echo "${BOLD}${RED}✗ $*${RESET}" >&2; exit 1; }

# --- docker compose v2 (plugin) o v1 (binario) ---
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "No se encontró 'docker compose' ni 'docker-compose'. Instalá Docker Compose."
fi

# --- Comprobaciones previas ---
command -v git >/dev/null 2>&1 || die "git no está instalado."
[ -f .env ] || die "Falta el archivo .env de producción en $REPO_ROOT."

# El schema vive en el workspace de la API; la ruta es relativa a /app dentro del contenedor.
PRISMA_SCHEMA="apps/api/prisma/schema.prisma"

# ------------------------------------------------------------------
log "1/6  Trayendo el último código de origin/main"
# El VPS es un entorno de deploy: forzamos el estado exacto del remoto.
# 'reset --hard' NO toca archivos sin trackear como .env (está en .gitignore).
git fetch --prune origin
git reset --hard origin/main
echo "    HEAD -> $(git rev-parse --short HEAD)  $(git log -1 --pretty=%s)"

# ------------------------------------------------------------------
log "2/6  Reconstruyendo imágenes (api, web)"
$DC build api web

# ------------------------------------------------------------------
log "3/6  Levantando la base de datos y esperando a que esté lista"
$DC up -d db

# Esperar hasta 60s a que Postgres acepte conexiones antes de migrar.
DB_READY=0
for i in $(seq 1 30); do
  if $DC exec -T db pg_isready -q >/dev/null 2>&1; then
    DB_READY=1
    break
  fi
  printf '.'; sleep 2
done
echo
[ "$DB_READY" = "1" ] || die "La base de datos no respondió a tiempo. Abortando antes de migrar."

# ------------------------------------------------------------------
log "4/6  Aplicando migraciones de Prisma (migrate deploy)"
# Contenedor efímero con la imagen recién construida de la API.
# 'migrate deploy' solo aplica migraciones ya existentes: no genera ni resetea nada.
$DC run --rm --no-deps api npx prisma migrate deploy --schema="$PRISMA_SCHEMA"

# ------------------------------------------------------------------
log "5/6  Recreando API y Web con las imágenes nuevas"
$DC up -d

# ------------------------------------------------------------------
log "6/6  Limpiando imágenes colgadas"
docker image prune -f >/dev/null 2>&1 || warn "No se pudo limpiar imágenes (continuo igual)."

echo
log "Deploy completo ✔"
$DC ps
