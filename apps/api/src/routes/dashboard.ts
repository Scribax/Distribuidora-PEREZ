import { Router } from "express";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { Rol } from "@prisma/client";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function metricsFor(start: Date, end: Date) {
  const [ventas, compras] = await Promise.all([
    prisma.remito.aggregate({ _sum: { total: true }, where: { estado: "ACTIVO", fecha: { gte: start, lte: end } } }),
    prisma.compra.aggregate({ _sum: { total: true }, where: { estado: "ACTIVA", fecha: { gte: start, lte: end } } })
  ]);
  return {
    ventas: Number(ventas._sum.total ?? 0),
    compras: Number(compras._sum.total ?? 0)
  };
}

dashboardRouter.get("/", async (_req, res) => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const [month, stockValueRows, stockBajo, ultimosRemitos] = await Promise.all([
    metricsFor(start, end),
    prisma.producto.findMany({ where: { activo: true }, select: { costo: true, stockActual: true } }),
    prisma.producto.findMany({ where: { activo: true, stockActual: { lte: prisma.producto.fields.stockMinimo } }, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    prisma.remito.findMany({ take: 10, include: { cliente: true }, orderBy: { numero: "desc" } })
  ]);
  const chart = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
    const date = subMonths(now, 5 - index);
    const m = await metricsFor(startOfMonth(date), endOfMonth(date));
    return { mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, ...m };
  }));
  const valorStock = stockValueRows.reduce((sum, p) => sum + Number(p.costo) * p.stockActual, 0);
  res.json({
    ventasMes: month.ventas,
    comprasMes: month.compras,
    balanceMes: month.ventas - month.compras,
    valorStock,
    stockBajo,
    ultimosRemitos,
    chart
  });
});

dashboardRouter.get("/balance", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const date = new Date(year, month - 1, 1);
  const m = await metricsFor(startOfMonth(date), endOfMonth(date));
  const stock = await prisma.producto.findMany({ where: { activo: true }, select: { costo: true, stockActual: true } });
  const valorStock = stock.reduce((sum, p) => sum + Number(p.costo) * p.stockActual, 0);
  res.json({ year, month, ventas: m.ventas, compras: m.compras, resultado: m.ventas - m.compras, valorStock });
});
