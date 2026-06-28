-- Normalize paid remittances created before payment state and paid amount were kept in sync.
-- If a remittance is marked PAGADA, its paid amount must equal total and the client debt must not include that remittance.
WITH inconsistentes AS (
  SELECT
    id,
    cliente_id,
    total,
    monto_pagado,
    GREATEST(total - monto_pagado, 0) AS diferencia
  FROM remitos
  WHERE estado = 'ACTIVO'
    AND pago_estado = 'PAGADA'
    AND monto_pagado < total
),
clientes_delta AS (
  SELECT cliente_id, SUM(diferencia) AS diferencia
  FROM inconsistentes
  GROUP BY cliente_id
)
UPDATE clientes c
SET saldo_pendiente = GREATEST(c.saldo_pendiente - cd.diferencia, 0)
FROM clientes_delta cd
WHERE c.id = cd.cliente_id;

UPDATE remitos r
SET monto_pagado = r.total
WHERE r.estado = 'ACTIVO'
  AND r.pago_estado = 'PAGADA'
  AND r.monto_pagado < r.total;
