CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "modulo" VARCHAR(60) NOT NULL,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(80) NOT NULL,
    "entidad_id" UUID,
    "descripcion" VARCHAR(300) NOT NULL,
    "cambios" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_usuario_id_idx" ON "audit_logs"("usuario_id");
CREATE INDEX "audit_logs_modulo_idx" ON "audit_logs"("modulo");
CREATE INDEX "audit_logs_accion_idx" ON "audit_logs"("accion");
CREATE INDEX "audit_logs_entidad_idx" ON "audit_logs"("entidad");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
