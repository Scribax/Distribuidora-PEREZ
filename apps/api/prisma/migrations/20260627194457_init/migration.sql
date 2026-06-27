-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'EMPLEADO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('COMPRA', 'REMITO', 'CANCELACION_REMITO', 'ANULACION_COMPRA', 'AJUSTE_MANUAL', 'ALTA_PRODUCTO', 'CAMBIO_COSTO');

-- CreateEnum
CREATE TYPE "CompraEstado" AS ENUM ('ACTIVA', 'ANULADA');

-- CreateEnum
CREATE TYPE "RemitoEstado" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ListaPrecios" AS ENUM ('MAYORISTA', 'MINORISTA');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "codigo_interno" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "categoria_id" UUID NOT NULL,
    "precio_mayorista" DECIMAL(12,2) NOT NULL,
    "precio_minorista" DECIMAL(12,2) NOT NULL,
    "costo" DECIMAL(12,2) NOT NULL,
    "stock_actual" INTEGER NOT NULL,
    "stock_minimo" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_resultante" INTEGER NOT NULL,
    "referencia_id" UUID,
    "referencia_tipo" VARCHAR(50),
    "motivo" VARCHAR(300),
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "empresa" VARCHAR(150),
    "direccion" VARCHAR(300),
    "telefono" VARCHAR(30),
    "email" VARCHAR(150),
    "observaciones" TEXT,
    "saldo_pendiente" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" UUID NOT NULL,
    "proveedor_nombre" VARCHAR(150) NOT NULL,
    "fecha" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" "CompraEstado" NOT NULL DEFAULT 'ACTIVA',
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_items" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "actualizar_costo" BOOLEAN NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remitos" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "cliente_id" UUID NOT NULL,
    "lista_precios" "ListaPrecios" NOT NULL,
    "saldo_cliente_al_emitir" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" "RemitoEstado" NOT NULL DEFAULT 'ACTIVO',
    "fecha" DATE NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remito_items" (
    "id" UUID NOT NULL,
    "remito_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "codigo_producto" VARCHAR(50) NOT NULL,
    "nombre_producto" VARCHAR(200) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "remito_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_interno_key" ON "productos"("codigo_interno");

-- CreateIndex
CREATE INDEX "productos_activo_idx" ON "productos"("activo");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_producto_id_idx" ON "movimientos_stock"("producto_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_created_at_idx" ON "movimientos_stock"("created_at");

-- CreateIndex
CREATE INDEX "clientes_activo_idx" ON "clientes"("activo");

-- CreateIndex
CREATE INDEX "compras_fecha_idx" ON "compras"("fecha");

-- CreateIndex
CREATE INDEX "compras_estado_idx" ON "compras"("estado");

-- CreateIndex
CREATE INDEX "compra_items_producto_id_idx" ON "compra_items"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "remitos_numero_key" ON "remitos"("numero");

-- CreateIndex
CREATE INDEX "remitos_cliente_id_idx" ON "remitos"("cliente_id");

-- CreateIndex
CREATE INDEX "remitos_estado_idx" ON "remitos"("estado");

-- CreateIndex
CREATE INDEX "remitos_fecha_idx" ON "remitos"("fecha");

-- CreateIndex
CREATE INDEX "remito_items_producto_id_idx" ON "remito_items"("producto_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remitos" ADD CONSTRAINT "remitos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remitos" ADD CONSTRAINT "remitos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remito_items" ADD CONSTRAINT "remito_items_remito_id_fkey" FOREIGN KEY ("remito_id") REFERENCES "remitos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remito_items" ADD CONSTRAINT "remito_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
