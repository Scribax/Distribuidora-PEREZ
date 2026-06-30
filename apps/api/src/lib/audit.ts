import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";

type Db = PrismaClient | Prisma.TransactionClient;

type AuditInput = {
  usuarioId: string;
  modulo: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  descripcion: string;
  cambios?: unknown;
};

function normalize(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && "toJSON" in value && typeof value.toJSON === "function") return value.toJSON();
  return value ?? null;
}

export function diffFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined, fields: string[]) {
  const changes: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const field of fields) {
    const previous = normalize(before?.[field]);
    const next = normalize(after?.[field]);
    if (JSON.stringify(previous) !== JSON.stringify(next)) changes[field] = { antes: previous, despues: next };
  }
  return Object.keys(changes).length ? changes : undefined;
}

function cleanJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;
  if ("toJSON" in value && typeof value.toJSON === "function") return cleanJson(value.toJSON());
  if (Array.isArray(value)) return value.map((item) => cleanJson(item));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, cleanJson(item)])
  );
}

export async function audit(input: AuditInput, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      usuarioId: input.usuarioId,
      modulo: input.modulo,
      accion: input.accion,
      entidad: input.entidad,
      entidadId: input.entidadId ?? null,
      descripcion: input.descripcion,
      cambios: cleanJson(input.cambios) as Prisma.InputJsonValue
    }
  });
}
