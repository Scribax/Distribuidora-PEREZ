import { Router } from "express";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { Rol } from "@prisma/client";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function metricsFor(start: Date, end: Date) {
  const [ventas, compras, costoVendidoRows, gastos] = await Promise.all([
    prisma.remito.aggregate({ _sum: { total: true }, where: { estado: "ACTIVO", fecha: { gte: start, lte: end } } }),
    prisma.compra.aggregate({ _sum: { total: true }, where: { estado: "ACTIVA", fecha: { gte: start, lte: end } } }),
    prisma.remitoItem.findMany({ where: { remito: { estado: "ACTIVO", fecha: { gte: start, lte: end } } }, select: { costoTotal: true } }),
    prisma.gasto.aggregate({ _sum: { monto: true }, where: { fecha: { gte: start, lte: end } } })
  ]);
  const ventasTotal = Number(ventas._sum.total ?? 0);
  const costoVendido = costoVendidoRows.reduce((sum, item) => sum + Number(item.costoTotal), 0);
  const gastosTotal = Number(gastos._sum.monto ?? 0);
  return {
    ventas: ventasTotal,
    compras: Number(compras._sum.total ?? 0),
    costoVendido,
    gananciaBruta: ventasTotal - costoVendido,
    gastos: gastosTotal,
    gananciaNeta: ventasTotal - costoVendido - gastosTotal
  };
}

dashboardRouter.get("/", async (req, res) => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const [month, stockValueRows, stockBajo, ultimosRemitos] = await Promise.all([
    metricsFor(start, end),
    prisma.producto.findMany({ where: { activo: true }, select: { costo: true, stockActual: true } }),
    prisma.producto.findMany({ where: { activo: true, stockMinimo: { gt: 0 }, stockActual: { lte: prisma.producto.fields.stockMinimo } }, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    prisma.remito.findMany({ take: 10, include: { cliente: true, vendedor: true }, orderBy: { numero: "desc" } })
  ]);
  const chart = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
    const date = subMonths(now, 5 - index);
    const m = await metricsFor(startOfMonth(date), endOfMonth(date));
    return { mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, ...m };
  }));
  const valorStock = stockValueRows.reduce((sum, p) => sum + Number(p.costo) * p.stockActual, 0);

  // El rol CONSULTA no accede a datos de rentabilidad (costos, ganancias, gastos, valor de stock).
  const verFinanzas = req.user!.rol !== Rol.CONSULTA;
  if (!verFinanzas) {
    return res.json({
      ventasMes: month.ventas,
      comprasMes: month.compras,
      stockBajo,
      ultimosRemitos,
      chart: chart.map((c) => ({ mes: c.mes, ventas: c.ventas }))
    });
  }

  res.json({
    ventasMes: month.ventas,
    comprasMes: month.compras,
    costoVendidoMes: month.costoVendido,
    gastosMes: month.gastos,
    balanceMes: month.gananciaNeta,
    gananciaBrutaMes: month.gananciaBruta,
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
  res.json({ year, month, ventas: m.ventas, compras: m.compras, costoVendido: m.costoVendido, gananciaBruta: m.gananciaBruta, gastos: m.gastos, resultado: m.gananciaNeta, valorStock });
});

dashboardRouter.get("/caja", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const date = new Date(year, month - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const [cobros, gastos] = await Promise.all([
    prisma.remito.groupBy({
      by: ["metodoPago"],
      where: { estado: "ACTIVO", fecha: { gte: start, lte: end }, metodoPago: { not: null }, montoPagado: { gt: 0 } },
      _sum: { montoPagado: true },
      _count: { _all: true }
    }),
    prisma.gasto.groupBy({
      by: ["metodoPago"],
      where: { fecha: { gte: start, lte: end }, metodoPago: { not: null } },
      _sum: { monto: true },
      _count: { _all: true }
    })
  ]);
  const methods = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"];
  const items = methods.map((metodo) => {
    const income = cobros.find((row) => row.metodoPago === metodo);
    const outcome = gastos.find((row) => row.metodoPago === metodo);
    const ingresos = Number(income?._sum.montoPagado ?? 0);
    const egresos = Number(outcome?._sum.monto ?? 0);
    return {
      metodoPago: metodo,
      ingresos,
      egresos,
      saldo: ingresos - egresos,
      cobros: income?._count._all ?? 0,
      gastos: outcome?._count._all ?? 0
    };
  });
  res.json({ year, month, items, totalIngresos: items.reduce((sum, item) => sum + item.ingresos, 0), totalEgresos: items.reduce((sum, item) => sum + item.egresos, 0), saldo: items.reduce((sum, item) => sum + item.saldo, 0) });
});
