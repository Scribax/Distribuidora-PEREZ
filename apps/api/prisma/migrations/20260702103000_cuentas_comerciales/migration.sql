CREATE TYPE "CuentaComercialTipo" AS ENUM ('APORTE', 'RETIRO', 'AJUSTE');

CREATE TABLE "cuentas_comerciales_movimientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendedor_id" UUID NOT NULL,
    "tipo" "CuentaComercialTipo" NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPago",
    "descripcion" VARCHAR(250) NOT NULL,
    "comprobante" VARCHAR(120),
    "observaciones" TEXT,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_comerciales_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cuentas_comerciales_movimientos_vendedor_id_idx" ON "cuentas_comerciales_movimientos"("vendedor_id");
CREATE INDEX "cuentas_comerciales_movimientos_fecha_idx" ON "cuentas_comerciales_movimientos"("fecha");
CREATE INDEX "cuentas_comerciales_movimientos_tipo_idx" ON "cuentas_comerciales_movimientos"("tipo");

ALTER TABLE "cuentas_comerciales_movimientos" ADD CONSTRAINT "cuentas_comerciales_movimientos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cuentas_comerciales_movimientos" ADD CONSTRAINT "cuentas_comerciales_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
