import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { clienteSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit, diffFields } from "../lib/audit.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const deletedClientsBackupDir = path.resolve(process.cwd(), "backups/clientes-eliminados");

function backupFileName(clientName: string, clientId: string) {
  const safeName = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "cliente";
  return `${new Date().toISOString().replace(/[:.]/g, "-")}_${safeName}_${clientId}.json`;
}

function remitoDebt(total: number, montoPagado: number, pagoEstado?: string) {
  if (pagoEstado === "PAGADA") return 0;
  return Number(Math.max(total - montoPagado, 0).toFixed(2));
}

clientsRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const q = String(req.query.q ?? "").trim();
  const where: Prisma.ClienteWhereInput = q ? {
    OR: [
      { nombre: { contains: q, mode: "insensitive" } },
      { empresa: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ]
  } : {};
  const [items, total] = await Promise.all([
    prisma.cliente.findMany({ where, skip, take, orderBy: { nombre: "asc" } }),
    prisma.cliente.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

clientsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { remitos: { orderBy: { fecha: "desc" }, take: 50, include: { items: true, vendedor: true } } }
  });
  if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  res.json(cliente);
});

clientsRouter.post("/", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = clienteSchema.parse(req.body);
  const cliente = await prisma.cliente.create({ data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Clientes",
    accion: "CREAR",
    entidad: "Cliente",
    entidadId: cliente.id,
    descripcion: `Creó el cliente ${cliente.nombre}`,
    cambios: { despues: cliente }
  });
  res.status(201).json(cliente);
});

clientsRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const input = clienteSchema.partial().parse(req.body);
  if ((input.activo === false || input.saldoPendiente !== undefined) && req.user!.rol !== Rol.ADMINISTRADOR) {
    fail(403, "SIN_PERMISO", "Solo el Administrador puede desactivar clientes o actualizar saldos");
  }
  const before = await prisma.cliente.findUnique({ where: { id } });
  if (!before) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  const cliente = await prisma.cliente.update({ where: { id }, data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Clientes",
    accion: "EDITAR",
    entidad: "Cliente",
    entidadId: cliente.id,
    descripcion: `Editó el cliente ${cliente.nombre}`,
    cambios: diffFields(before, cliente, ["nombre", "empresa", "direccion", "telefono", "email", "observaciones", "saldoPendiente", "activo"])
  });
  res.json(cliente);
});

clientsRouter.delete("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const id = String(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      remitos: {
        include: {
          items: true,
          vendedor: true,
          usuario: { select: { id: true, nombre: true, email: true, rol: true } }
        },
        orderBy: { fecha: "desc" }
      }
    }
  });
  if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  await fs.mkdir(deletedClientsBackupDir, { recursive: true });
  const backupPath = path.join(deletedClientsBackupDir, backupFileName(cliente.nombre, cliente.id));
  await fs.writeFile(backupPath, JSON.stringify({
    deletedAt: new Date().toISOString(),
    deletedBy: req.user,
    warning: "Backup generado automáticamente antes de eliminar definitivamente el cliente.",
    cliente
  }, null, 2), "utf8");

  await prisma.$transaction(async (tx) => {
    for (const remito of cliente.remitos) {
      if (remito.estado === "ACTIVO") {
        const pendingDebt = remitoDebt(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
        if (pendingDebt !== 0) {
          await tx.cliente.update({ where: { id: cliente.id }, data: { saldoPendiente: { decrement: pendingDebt } } });
        }
        for (const item of remito.items) {
          await tx.producto.update({ where: { id: item.productoId }, data: { stockActual: { increment: item.cantidad } } });
          const producto = await tx.producto.findUnique({ where: { id: item.productoId }, select: { stockActual: true } });
          await tx.movimientoStock.create({
            data: {
              productoId: item.productoId,
              tipo: "CANCELACION_REMITO",
              cantidad: item.cantidad,
              stockResultante: producto?.stockActual ?? item.cantidad,
              usuarioId: req.user!.id,
              referenciaId: remito.id,
              referenciaTipo: "Remito",
              motivo: `Restauración por eliminación definitiva del cliente ${cliente.nombre}`
            }
          });
        }
      }
      await tx.remitoItem.deleteMany({ where: { remitoId: remito.id } });
    }
    await tx.remito.deleteMany({ where: { clienteId: cliente.id } });
    await tx.cliente.delete({ where: { id: cliente.id } });
    await audit({
      usuarioId: req.user!.id,
      modulo: "Clientes",
      accion: "ELIMINAR",
      entidad: "Cliente",
      entidadId: cliente.id,
      descripcion: `Eliminó definitivamente el cliente ${cliente.nombre}`,
      cambios: { backupPath, boletasEliminadas: cliente.remitos.length, antes: cliente }
    }, tx);
  });
  res.status(204).send();
});
