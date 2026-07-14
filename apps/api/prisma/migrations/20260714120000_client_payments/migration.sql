CREATE TABLE "clientes_pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo_pago" "MetodoPago",
    "observaciones" TEXT,
    "saldo_anterior" DECIMAL(12,2) NOT NULL,
    "saldo_resultante" DECIMAL(12,2) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pagos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clientes_pagos_cliente_id_idx" ON "clientes_pagos"("cliente_id");
CREATE INDEX "clientes_pagos_fecha_idx" ON "clientes_pagos"("fecha");

ALTER TABLE "clientes_pagos" ADD CONSTRAINT "clientes_pagos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientes_pagos" ADD CONSTRAINT "clientes_pagos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
