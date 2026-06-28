-- CreateEnum
CREATE TYPE "GastoCategoria" AS ENUM ('COMBUSTIBLE', 'FLETE', 'ALQUILER', 'SUELDOS', 'SERVICIOS', 'MANTENIMIENTO', 'INSUMOS', 'IMPUESTOS', 'OTRO');

-- AlterTable
ALTER TABLE "remito_items" ADD COLUMN "costo_unitario" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "remito_items" ADD COLUMN "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill existing remittance items with current product costs as initial historical estimate.
UPDATE "remito_items" ri
SET
  "costo_unitario" = p."costo",
  "costo_total" = p."costo" * ri."cantidad"
FROM "productos" p
WHERE p."id" = ri."producto_id";

-- CreateTable
CREATE TABLE "gastos" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "categoria" "GastoCategoria" NOT NULL DEFAULT 'OTRO',
    "descripcion" VARCHAR(250) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPago",
    "comprobante" VARCHAR(120),
    "observaciones" TEXT,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_fecha_idx" ON "gastos"("fecha");

-- CreateIndex
CREATE INDEX "gastos_categoria_idx" ON "gastos"("categoria");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
