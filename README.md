# PEREZ MARTIN Distribuidora

Sistema de gestión operativa según `PEREZ_MARTIN_SRS.md`: autenticación, productos, stock, clientes, compras, remitos PDF, dashboard, balance básico y PWA.

## Desarrollo local

1. Copiar `.env.example` a `.env`.
2. Levantar PostgreSQL o usar `docker compose up db`.
3. Instalar dependencias:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

4. Ejecutar API y web:

```bash
npm run dev:api
npm run dev:web
```

Usuario inicial:

- Email: `admin@perez.local`
- Contraseña: `Admin1234`

## Producción

Configurar `.env` con secretos reales y ejecutar:

```bash
docker compose up -d --build
```

PostgreSQL queda dentro de la red interna de Docker. Nginx aplica headers de seguridad y rate limiting en login.

### Deploy en VPS

1. Instalar Docker, Docker Compose y Git en el servidor.
2. Clonar el repositorio:

```bash
git clone https://github.com/Scribax/Distribuidora-PEREZ.git
cd Distribuidora-PEREZ
```

3. Crear el archivo `.env` desde el ejemplo:

```bash
cp .env.example .env
nano .env
```

Valores recomendados para producción:

```env
POSTGRES_DB=perez_martin
POSTGRES_USER=perez
POSTGRES_PASSWORD=usar-una-password-larga
JWT_SECRET=usar-un-secreto-largo-de-al-menos-32-caracteres
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=7
CORS_ORIGIN=http://TU_DOMINIO_O_IP
VITE_API_URL=/api
```

4. Levantar la aplicación:

```bash
docker compose up -d --build
```

5. Ejecutar migraciones y seed inicial:

```bash
docker compose exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose exec api npm run seed -w apps/api
```

Usuario inicial:

- Email: `admin@perez.local`
- Contraseña: `Admin1234`

Después del primer ingreso, crear un nuevo administrador o cambiar la contraseña desde el módulo Usuarios.

6. Ver logs:

```bash
docker compose logs -f api
docker compose logs -f web
```

7. Actualizar versión en producción:

```bash
git pull
docker compose up -d --build
docker compose exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

## Backups

En VPS se recomienda instalar el timer systemd incluido. Ejecuta un backup diario a las 03:00, guarda archivos comprimidos en `/var/backups/perez`, conserva 30 días por defecto y mantiene un enlace `latest.sql.gz`.

Instalar o reinstalar:

```bash
cd ~/Distribuidora-PEREZ
chmod +x scripts/*.sh
PROJECT_DIR="$(pwd)" ./scripts/install-backup-systemd.sh
```

Ver estado:

```bash
systemctl status perez-backup.timer --no-pager
systemctl list-timers perez-backup.timer --no-pager
ls -lh /var/backups/perez
```

Ejecutar un backup manual:

```bash
cd ~/Distribuidora-PEREZ
BACKUP_DIR=/var/backups/perez ./scripts/backup-postgres.sh
```

Restaurar un backup en el contenedor de PostgreSQL:

```bash
cd ~/Distribuidora-PEREZ
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < <(gunzip -c /var/backups/perez/latest.sql.gz)
```

Alternativa con cron diario a las 03:00:

```cron
0 3 * * * cd /root/Distribuidora-PEREZ && BACKUP_DIR=/var/backups/perez ./scripts/backup-postgres.sh >> /var/log/perez-backup.log 2>&1
```
