import type { Request } from "express";
import { prisma } from "./prisma.js";

// Cuánto tiempo conservamos una clave de idempotencia. Pasado ese lapso, un
// reintento del mismo POST es tan improbable que preferimos liberar la fila.
const RETENTION_HOURS = Number(process.env.IDEMPOTENCY_RETENTION_HOURS ?? 48);
// Cada cuánto corre la limpieza dentro del proceso de la API.
const SWEEP_INTERVAL_HOURS = Number(process.env.IDEMPOTENCY_SWEEP_HOURS ?? 6);

// Lee y valida el header de idempotencia. La clave (el id de la operación
// offline local) permite que un reintento del mismo POST no cree un recurso
// duplicado cuando la respuesta original se perdió en la red.
export function idempotencyKeyFrom(req: Request) {
  const raw = req.header("Idempotency-Key");
  if (!raw) return null;
  const key = raw.trim();
  if (!key || key.length > 200) return null;
  return key;
}

// Borra las claves más viejas que RETENTION_HOURS. Devuelve cuántas eliminó.
export async function purgeExpiredIdempotencyKeys() {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });
  return count;
}

// Arranca la limpieza periódica. Corre una vez al inicio y luego cada
// SWEEP_INTERVAL_HOURS. Los errores se loguean pero nunca tumban el proceso.
// unref() evita que el timer mantenga vivo el proceso durante un apagado.
export function startIdempotencyCleanup() {
  const sweep = () => {
    purgeExpiredIdempotencyKeys()
      .then((count) => {
        if (count > 0) console.log(`[idempotency] Limpieza: ${count} clave(s) vencida(s) eliminada(s).`);
      })
      .catch((err) => console.error("[idempotency] Error en la limpieza:", err));
  };
  sweep();
  const timer = setInterval(sweep, SWEEP_INTERVAL_HOURS * 60 * 60 * 1000);
  timer.unref();
  return timer;
}
