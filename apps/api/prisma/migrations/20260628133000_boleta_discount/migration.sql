ALTER TABLE "remitos" ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "remitos" ADD COLUMN "descuento_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0;

UPDATE "remitos" SET "subtotal" = "total" WHERE "subtotal" = 0;
