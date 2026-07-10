# Distribuidora PEREZ

Sistema privado de gestion para una distribuidora.

## Alcance

La aplicacion centraliza operaciones internas como catalogo, stock, clientes, compras, ventas, gastos, balances, informes y auditoria.

## Stack

- React + Vite
- Node.js + Express
- PostgreSQL
- Prisma
- Docker Compose
- Nginx

## Configuracion

Este repositorio no documenta credenciales, secretos, URLs productivas ni datos operativos.

Para ejecutar el sistema se requiere configurar variables de entorno locales o de servidor. Usar `.env.example` solo como plantilla de nombres de variables, reemplazando todos los valores por secretos propios.

## Desarrollo

```bash
npm install
npm run prisma:generate
npm run dev:api
npm run dev:web
```

## Produccion

El despliegue productivo se realiza con Docker Compose en el servidor configurado para el proyecto.

```bash
docker compose up -d --build
```

Las migraciones de base de datos deben ejecutarse desde el contenedor de API cuando corresponda.

## Backups

El proyecto incluye scripts para generar backups de PostgreSQL y, opcionalmente, copiarlos a un destino externo con `rclone`.

La configuracion real de backups debe mantenerse fuera del repositorio, por ejemplo en archivos del servidor como `/etc/perez-backup.env`.

## Seguridad

No subir al repositorio:

- archivos `.env`
- credenciales de usuarios
- passwords de base de datos
- secretos JWT
- tokens de servicios externos
- claves de Cloudflare, R2, Google Drive u otros proveedores
- backups de base de datos

Si alguna credencial fue publicada alguna vez, debe considerarse comprometida y rotarse.
