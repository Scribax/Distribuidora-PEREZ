# 📦 Distribuidora PEREZ - Sistema de Gestión

¡Bienvenido al repositorio del Sistema de Gestión Integral para Distribuidora PEREZ! Este proyecto centraliza y optimiza las operaciones internas de la distribuidora.

## 🚀 Descripción del Proyecto

Esta aplicación es un sistema privado diseñado a medida para gestionar las operaciones diarias de una distribuidora. Su objetivo principal es ofrecer una plataforma robusta y centralizada para:

*   **📦 Catálogo y Stock:** Gestión detallada de productos y control de inventario.
*   **👥 Clientes:** Registro y seguimiento de la cartera de clientes.
*   **🛒 Compras y Ventas:** Registro de transacciones comerciales.
*   **💰 Finanzas:** Control de gastos, balances e informes financieros.
*   **🔒 Auditoría:** Trazabilidad de operaciones críticas.

## 🛠️ Stack Tecnológico

El proyecto está construido bajo una arquitectura moderna (monorepo) y contenedorizada:

### Frontend (Aplicación Web)
*   **Framework:** React
*   **Build Tool:** Vite

### Backend (API REST)
*   **Entorno:** Node.js
*   **Framework:** Express
*   **ORM:** Prisma

### Base de Datos & Infraestructura
*   **Motor DB:** PostgreSQL
*   **Contenedores:** Docker & Docker Compose
*   **Proxy Inverso:** Nginx

---

## ⚙️ Configuración y Desarrollo Local

> **⚠️ Importante sobre Seguridad:** Este repositorio **NUNCA** debe contener credenciales, secretos, URLs productivas ni datos reales operativos. Asegúrate de que tu `.gitignore` esté bien configurado.

### Prerrequisitos
*   Node.js instalado
*   Docker y Docker Compose instalados

### Pasos para levantar el entorno de desarrollo:

1.  **Variables de Entorno:**
    Copia el archivo de ejemplo para crear tu propio `.env`:
    ```bash
    cp .env.example .env
    ```
    *Edita el archivo `.env` e ingresa los valores (ej. credenciales de base de datos local).*

2.  **Instalación de Dependencias:**
    Desde la raíz del proyecto (monorepo), ejecuta:
    ```bash
    npm install
    ```

3.  **Base de Datos (Prisma):**
    Genera el cliente de Prisma:
    ```bash
    npm run prisma:generate
    ```
    *(Si necesitas correr migraciones locales, usa `npm run prisma:migrate`)*

4.  **Ejecución:**
    Levanta la API y la aplicación Web simultáneamente en modo desarrollo:
    ```bash
    # En una terminal:
    npm run dev:api

    # En otra terminal:
    npm run dev:web
    ```

---

## 🚢 Despliegue en Producción

El sistema está diseñado para desplegarse fácilmente usando contenedores.

1.  Asegúrate de configurar el archivo `.env` de producción en el servidor.
2.  Ejecuta el build y levanta los servicios en modo *detached* (segundo plano):
    ```bash
    docker compose up -d --build
    ```
3.  *Nota:* Las migraciones de base de datos en producción deben ejecutarse directamente dentro del contenedor de la API cuando sea necesario.

---

## 💾 Backups

El proyecto incluye scripts automatizados en la carpeta `scripts/` para realizar copias de seguridad de PostgreSQL. Opcionalmente, se pueden sincronizar con almacenamiento externo usando `rclone`.

**Configuración de Backups:**
Las variables sensibles para los backups (como tokens de nube o credenciales) **deben residir fuera del repositorio**, por ejemplo, en un archivo protegido del servidor como `/etc/perez-backup.env`.

---

## 🛡️ Política de Seguridad

**Regla de Oro:** Si algún secreto se sube por error a GitHub, **debe considerarse comprometido y cambiarse inmediatamente**.

**Archivos estrictamente prohibidos en el repositorio:**
*   Cualquier archivo `.env` (excepto `.env.example`).
*   Credenciales de usuarios o passwords de base de datos.
*   Secretos JWT (`JWT_SECRET`).
*   Tokens de APIs de terceros.
*   Claves de proveedores cloud (Cloudflare, R2, AWS, Google Drive, etc.).
*   Dumps o backups de bases de datos (`.sql`, `.tar`, etc.).