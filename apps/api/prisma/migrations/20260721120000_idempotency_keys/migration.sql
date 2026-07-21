CREATE TABLE "idempotency_keys" (
    "key" VARCHAR(200) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "metodo" VARCHAR(10) NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");
