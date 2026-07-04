CREATE TABLE "clientes_historial_importaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "origen" VARCHAR(40) NOT NULL DEFAULT 'PDF',
    "nombre_original" VARCHAR(150) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_historial_importaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientes_facturas_historicas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "importacion_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuesto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "clientes_facturas_historicas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clientes_historial_importaciones_cliente_id_idx" ON "clientes_historial_importaciones"("cliente_id");
CREATE INDEX "clientes_historial_importaciones_created_at_idx" ON "clientes_historial_importaciones"("created_at");
CREATE INDEX "clientes_facturas_historicas_importacion_id_idx" ON "clientes_facturas_historicas"("importacion_id");
CREATE INDEX "clientes_facturas_historicas_fecha_idx" ON "clientes_facturas_historicas"("fecha");

ALTER TABLE "clientes_historial_importaciones" ADD CONSTRAINT "clientes_historial_importaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientes_historial_importaciones" ADD CONSTRAINT "clientes_historial_importaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clientes_facturas_historicas" ADD CONSTRAINT "clientes_facturas_historicas_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "clientes_historial_importaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
