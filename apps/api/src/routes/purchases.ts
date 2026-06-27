import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { compraSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { adjustProductStock, ensureActiveProducts } from "../lib/stock.js";

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);

purchasesRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const proveedor = String(req.query.proveedor ?? "").trim();
  const productoId = String(req.query.productoId ?? "");
  const fechaDesde = req.query.fechaDesde ? new Date(String(req.query.fechaDesde)) : undefined;
  const fechaHasta = req.query.fechaHasta ? new Date(String(req.query.fechaHasta)) : undefined;
  const where: Prisma.CompraWhereInput = {
    proveedorNombre: proveedor ? { contains: proveedor, mode: "insensitive" } : undefined,
    fecha: fechaDesde || fechaHasta ? { gte: fechaDesde, lte: fechaHasta } : undefined,
    items: productoId ? { some: { productoId } } : undefined
  };
  const [items, total] = await Promise.all([
    prisma.compra.findMany({ where, skip, take, include: { items: true, usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }),
    prisma.compra.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

purchasesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const compra = await prisma.compra.findUnique({
    where: { id },
    include: { items: { include: { producto: true } }, usuario: { select: { nombre: true } } }
  });
  if (!compra) fail(404, "COMPRA_NO_ENCONTRADA", "Compra no encontrada");
  res.json(compra);
});

purchasesRouter.post("/", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = compraSchema.parse(req.body);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (input.fecha > tomorrow) fail(400, "FECHA_INVALIDA", "La fecha de compra no puede ser futura más de 1 día");

  const compra = await prisma.$transaction(async (tx) => {
    const productos = await ensureActiveProducts(tx, input.items.map((i) => i.productoId));
    const productMap = new Map(productos.map((p) => [p.id, p]));
    const total = input.items.reduce((sum, item) => sum + item.cantidad * item.costoUnitario, 0);
    const created = await tx.compra.create({
      data: {
        proveedorNombre: input.proveedorNombre,
        fecha: input.fecha,
        total,
        usuarioId: req.user!.id,
        items: {
          create: input.items.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
            actualizarCosto: item.actualizarCosto,
            subtotal: item.cantidad * item.costoUnitario
          }))
        }
      },
      include: { items: true }
    });

    for (const item of input.items) {
      await adjustProductStock(tx, {
        productoId: item.productoId,
        delta: item.cantidad,
        tipo: "COMPRA",
        usuarioId: req.user!.id,
        referenciaId: created.id,
        referenciaTipo: "Compra"
      });
      if (item.actualizarCosto && productMap.has(item.productoId)) {
        await tx.producto.update({ where: { id: item.productoId }, data: { costo: item.costoUnitario } });
      }
    }
    return created;
  });

  res.status(201).json(compra);
});

purchasesRouter.post("/:id/anular", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const id = String(req.params.id);
  const compra = await prisma.compra.findUnique({ where: { id }, include: { items: true } });
  if (!compra) fail(404, "COMPRA_NO_ENCONTRADA", "Compra no encontrada");
  if (compra.estado === "ANULADA") fail(422, "COMPRA_ANULADA", "La compra ya fue anulada");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.compra.update({ where: { id: compra.id }, data: { estado: "ANULADA" }, include: { items: true } });
    for (const item of updated.items) {
      await adjustProductStock(tx, {
        productoId: item.productoId,
        delta: -item.cantidad,
        tipo: "ANULACION_COMPRA",
        usuarioId: req.user!.id,
        referenciaId: compra.id,
        referenciaTipo: "Compra",
        motivo: "Anulación de compra"
      });
    }
  });

  res.status(204).send();
});
