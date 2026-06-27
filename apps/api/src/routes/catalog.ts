import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { categoriaSchema, productoSchema, productoUpdateSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { adjustProductStock } from "../lib/stock.js";

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

catalogRouter.get("/categorias", async (_req, res) => {
  res.json(await prisma.categoria.findMany({ orderBy: { nombre: "asc" } }));
});

catalogRouter.post("/categorias", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = categoriaSchema.parse(req.body);
  try {
    const categoria = await prisma.categoria.create({ data: input });
    res.status(201).json(categoria);
  } catch {
    fail(422, "CATEGORIA_DUPLICADA", "La categoría ya existe");
  }
});

catalogRouter.patch("/categorias/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const id = String(req.params.id);
  const input = categoriaSchema.partial().parse(req.body);
  res.json(await prisma.categoria.update({ where: { id }, data: input }));
});

catalogRouter.get("/productos", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const q = String(req.query.q ?? "").trim();
  const estado = String(req.query.estado ?? "");
  const categoriaId = String(req.query.categoriaId ?? "");
  const where: Prisma.ProductoWhereInput = {
    AND: [
      q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { codigoInterno: { contains: q, mode: "insensitive" } }, { categoria: { nombre: { contains: q, mode: "insensitive" } } }] } : {},
      estado === "ACTIVO" ? { activo: true } : estado === "INACTIVO" ? { activo: false } : {},
      categoriaId ? { categoriaId } : {}
    ]
  };
  const [items, total] = await Promise.all([
    prisma.producto.findMany({ where, skip, take, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    prisma.producto.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

catalogRouter.get("/productos/:id", async (req, res) => {
  const id = String(req.params.id);
  const producto = await prisma.producto.findUnique({
    where: { id },
    include: { categoria: true, movimientos: { orderBy: { createdAt: "desc" }, take: 50 } }
  });
  if (!producto) fail(404, "PRODUCTO_NO_ENCONTRADO", "Producto no encontrado");
  res.json(producto);
});

catalogRouter.post("/productos", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = productoSchema.parse(req.body);
  const categoria = await prisma.categoria.findUnique({ where: { id: input.categoriaId } });
  if (!categoria?.activo) fail(422, "CATEGORIA_INACTIVA", "La categoría debe existir y estar activa");
  try {
    const producto = await prisma.$transaction(async (tx) => {
      const created = await tx.producto.create({ data: input });
      if (created.stockActual > 0) {
        await tx.movimientoStock.create({
          data: {
            productoId: created.id,
            tipo: "ALTA_PRODUCTO",
            cantidad: created.stockActual,
            stockResultante: created.stockActual,
            usuarioId: req.user!.id,
            motivo: "Stock inicial del producto"
          }
        });
      }
      return created;
    });
    res.status(201).json(producto);
  } catch {
    fail(422, "CODIGO_DUPLICADO", "El código interno ya existe en otro producto");
  }
});

catalogRouter.patch("/productos/:id", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const input = productoUpdateSchema.parse(req.body);
  const current = await prisma.producto.findUnique({ where: { id } });
  if (!current) fail(404, "PRODUCTO_NO_ENCONTRADO", "Producto no encontrado");
  const movementsCount = await prisma.movimientoStock.count({ where: { productoId: id } });
  if (input.codigoInterno && input.codigoInterno !== current.codigoInterno && movementsCount > 0) {
    fail(422, "CODIGO_NO_EDITABLE", "El código interno no puede modificarse si el producto tiene movimientos registrados");
  }
  if (input.activo === false && req.user!.rol !== Rol.ADMINISTRADOR) fail(403, "SIN_PERMISO", "Solo el Administrador puede desactivar productos");

  const producto = await prisma.$transaction(async (tx) => {
    const stockDelta = typeof input.stockActual === "number" ? input.stockActual - current.stockActual : 0;
    const updated = await tx.producto.update({
      where: { id },
      data: { ...input, stockActual: current.stockActual }
    });
    if (stockDelta !== 0 && typeof input.stockActual === "number") {
      await adjustProductStock(tx, {
        productoId: current.id,
        delta: stockDelta,
        tipo: "AJUSTE_MANUAL",
        usuarioId: req.user!.id,
        motivo: "Ajuste desde edición de producto"
      });
    }
    return updated;
  });
  res.json(producto);
});

catalogRouter.post("/stock/ajustes", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const { ajusteStockSchema } = await import("../lib/schemas.js");
  const input = ajusteStockSchema.parse(req.body);
  const producto = await prisma.producto.findUnique({ where: { id: input.productoId } });
  if (!producto) fail(404, "PRODUCTO_NO_ENCONTRADO", "Producto no encontrado");
  await prisma.$transaction((tx) => adjustProductStock(tx, {
    productoId: input.productoId,
    delta: input.cantidadNueva - producto.stockActual,
    tipo: "AJUSTE_MANUAL",
    usuarioId: req.user!.id,
    motivo: input.motivo
  }));
  res.status(204).send();
});

catalogRouter.get("/stock/movimientos", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const productoId = String(req.query.productoId ?? "");
  const tipo = String(req.query.tipo ?? "");
  const fechaDesde = req.query.fechaDesde ? new Date(String(req.query.fechaDesde)) : undefined;
  const fechaHasta = req.query.fechaHasta ? new Date(String(req.query.fechaHasta)) : undefined;
  const where: Prisma.MovimientoStockWhereInput = {
    productoId: productoId || undefined,
    tipo: tipo ? (tipo as any) : undefined,
    createdAt: fechaDesde || fechaHasta ? { gte: fechaDesde, lte: fechaHasta } : undefined
  };
  const [items, total] = await Promise.all([
    prisma.movimientoStock.findMany({ where, skip, take, include: { producto: true, usuario: { select: { nombre: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.movimientoStock.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});
