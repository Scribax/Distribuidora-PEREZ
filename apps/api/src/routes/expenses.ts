import { Router } from "express";
import { GastoCategoria, Prisma, Rol } from "@prisma/client";
import { endOfDay } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { gastoSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit, diffFields } from "../lib/audit.js";

export const expensesRouter = Router();
expensesRouter.use(requireAuth, requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO));

expensesRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const q = String(req.query.q ?? "").trim();
  const categoria = String(req.query.categoria ?? "");
  const fechaDesde = req.query.fechaDesde ? new Date(String(req.query.fechaDesde)) : undefined;
  const fechaHasta = req.query.fechaHasta ? endOfDay(new Date(String(req.query.fechaHasta))) : undefined;
  const where: Prisma.GastoWhereInput = {
    categoria: categoria ? categoria as GastoCategoria : undefined,
    fecha: fechaDesde || fechaHasta ? { gte: fechaDesde, lte: fechaHasta } : undefined,
    OR: q ? [
      { descripcion: { contains: q, mode: "insensitive" } },
      { comprobante: { contains: q, mode: "insensitive" } },
      { observaciones: { contains: q, mode: "insensitive" } }
    ] : undefined
  };
  const [items, total, sum] = await Promise.all([
    prisma.gasto.findMany({ where, skip, take, include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }),
    prisma.gasto.count({ where }),
    prisma.gasto.aggregate({ where, _sum: { monto: true } })
  ]);
  res.json({ items, total, page, pageSize, montoTotal: Number(sum._sum.monto ?? 0) });
});

expensesRouter.post("/", async (req, res) => {
  const input = gastoSchema.parse(req.body);
  if (Number(input.monto) <= 0) fail(422, "MONTO_INVALIDO", "El monto del gasto debe ser mayor a cero");
  const gasto = await prisma.gasto.create({ data: { ...input, usuarioId: req.user!.id } });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Gastos",
    accion: "CREAR",
    entidad: "Gasto",
    entidadId: gasto.id,
    descripcion: `Registró gasto: ${gasto.descripcion}`,
    cambios: { despues: gasto }
  });
  res.status(201).json(gasto);
});

expensesRouter.patch("/:id", async (req, res) => {
  const input = gastoSchema.partial().parse(req.body);
  if (input.monto !== undefined && Number(input.monto) <= 0) fail(422, "MONTO_INVALIDO", "El monto del gasto debe ser mayor a cero");
  const before = await prisma.gasto.findUnique({ where: { id: String(req.params.id) } });
  if (!before) fail(404, "GASTO_NO_ENCONTRADO", "Gasto no encontrado");
  const gasto = await prisma.gasto.update({ where: { id: String(req.params.id) }, data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Gastos",
    accion: "EDITAR",
    entidad: "Gasto",
    entidadId: gasto.id,
    descripcion: `Editó gasto: ${gasto.descripcion}`,
    cambios: diffFields(before, gasto, ["fecha", "categoria", "descripcion", "monto", "metodoPago", "comprobante", "observaciones"])
  });
  res.json(gasto);
});

expensesRouter.delete("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const gasto = await prisma.gasto.delete({ where: { id: String(req.params.id) } });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Gastos",
    accion: "ELIMINAR",
    entidad: "Gasto",
    entidadId: gasto.id,
    descripcion: `Eliminó gasto: ${gasto.descripcion}`,
    cambios: { antes: gasto }
  });
  res.status(204).send();
});
