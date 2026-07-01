import type { Prisma, PrismaClient } from "@prisma/client";
import { fail } from "./errors.js";

type Tx = Prisma.TransactionClient;

export async function adjustProductStock(
  tx: Tx,
  args: {
    productoId: string;
    delta: number;
    tipo: Prisma.MovimientoStockUncheckedCreateInput["tipo"];
    usuarioId: string;
    referenciaId?: string;
    referenciaTipo?: string;
    motivo?: string;
  }
) {
  const producto = await tx.producto.findUnique({ where: { id: args.productoId } });
  if (!producto) fail(404, "PRODUCTO_NO_ENCONTRADO", "Producto no encontrado");

  // Actualización atómica: solo aplica el delta si el stock resultante no queda negativo.
  // El guard va dentro del WHERE para evitar condiciones de carrera (lost updates) entre
  // operaciones concurrentes que leen-modifican-escriben el mismo producto.
  const guard =
    args.delta < 0
      ? { stockActual: { gte: -args.delta } }
      : {};
  const updated = await tx.producto.updateMany({
    where: { id: args.productoId, ...guard },
    data: { stockActual: { increment: args.delta } }
  });

  if (updated.count === 0) {
    fail(422, "STOCK_NEGATIVO", "La operación resultaría en stock negativo", {
      producto: producto.nombre,
      stock_disponible: producto.stockActual,
      cantidad_solicitada: Math.abs(args.delta)
    });
  }

  // Leemos el valor real tras el incremento atómico para registrar el movimiento
  // con el stock resultante correcto incluso bajo operaciones concurrentes.
  const after = await tx.producto.findUnique({
    where: { id: args.productoId },
    select: { stockActual: true }
  });
  const stockResultante = after?.stockActual ?? producto.stockActual + args.delta;

  await tx.movimientoStock.create({
    data: {
      productoId: args.productoId,
      tipo: args.tipo,
      cantidad: args.delta,
      stockResultante,
      referenciaId: args.referenciaId,
      referenciaTipo: args.referenciaTipo,
      motivo: args.motivo,
      usuarioId: args.usuarioId
    }
  });
}

export async function ensureActiveProducts(tx: Tx | PrismaClient, ids: string[]) {
  const productos = await tx.producto.findMany({ where: { id: { in: ids } } });
  const found = new Map(productos.map((p) => [p.id, p]));
  for (const id of ids) {
    const producto = found.get(id);
    if (!producto) fail(404, "PRODUCTO_NO_ENCONTRADO", "Producto no encontrado");
    if (!producto.activo) fail(422, "PRODUCTO_INACTIVO", `El producto ${producto.nombre} está inactivo`);
  }
  return productos;
}

export function aggregateItems<T extends { productoId: string; cantidad: number }>(items: T[]) {
  const byProduct = new Map<string, number>();
  for (const item of items) byProduct.set(item.productoId, (byProduct.get(item.productoId) ?? 0) + item.cantidad);
  return byProduct;
}
