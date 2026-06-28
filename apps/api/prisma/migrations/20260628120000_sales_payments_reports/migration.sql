-- CreateEnum
CREATE TYPE "PagoEstado" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'OTRO');

-- CreateTable
CREATE TABLE "vendedores" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "porcentaje_comision" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "remitos" ADD COLUMN "vendedor_id" UUID;
ALTER TABLE "remitos" ADD COLUMN "monto_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "remitos" ADD COLUMN "pago_estado" "PagoEstado" NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "remitos" ADD COLUMN "metodo_pago" "MetodoPago";

-- CreateIndex
CREATE INDEX "vendedores_activo_idx" ON "vendedores"("activo");

-- CreateIndex
CREATE INDEX "remitos_vendedor_id_idx" ON "remitos"("vendedor_id");

-- CreateIndex
CREATE INDEX "remitos_pago_estado_idx" ON "remitos"("pago_estado");

-- AddForeignKey
ALTER TABLE "remitos" ADD CONSTRAINT "remitos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
