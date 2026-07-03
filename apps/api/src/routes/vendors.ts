import { Router } from "express";
import { endOfMonth, startOfMonth } from "date-fns";
import { CuentaComercialTipo, MetodoPago, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { cuentaComercialMovimientoSchema, vendedorSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit, diffFields } from "../lib/audit.js";

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);


function periodFromQuery(query: any) {
  const now = new Date();
  const year = Number(query.year ?? now.getFullYear());
  const month = Number(query.month ?? now.getMonth() + 1);
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    fail(422, "PERIODO_INVALIDO", "El periodo de comisiones no es valido");
  }
  const date = new Date(year, month - 1, 1);
  return { year, month, start: startOfMonth(date), end: endOfMonth(date), key: `${year}-${String(month).padStart(2, "0")}` };
}

async function commissionRows(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const vendors = await prisma.vendedor.findMany({ orderBy: { nombre: "asc" } });
  const stats = await prisma.remito.groupBy({
    by: ["vendedorId"],
    where: { estado: "ACTIVO", vendedorId: { not: null }, fecha: { gte: start, lte: end } },
    _sum: { total: true },
    _count: { _all: true }
  });
  const statsByVendor = new Map(stats.map((row) => [row.vendedorId, row]));
  return vendors.map((vendor) => {
    const row = statsByVendor.get(vendor.id);
    const ventasTotal = Number(row?._sum.total ?? 0);
    const porcentaje = Number(vendor.porcentajeComision);
    const comisionTotal = Math.round((ventasTotal * porcentaje / 100) * 100) / 100;
    return { vendor, ventasTotal, porcentaje, comisionTotal, boletasTotal: row?._count._all ?? 0 };
  });
}

async function commercialAccountRows(year: number, month: number) {
  const { start, end } = periodFromQuery({ year, month });
  const [vendors, movements, periodMovements, commissions] = await Promise.all([
    prisma.vendedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.cuentaComercialMovimiento.groupBy({
      by: ["vendedorId", "tipo"],
      _sum: { monto: true }
    }),
    prisma.cuentaComercialMovimiento.groupBy({
      by: ["vendedorId", "tipo"],
      where: { fecha: { gte: start, lte: end } },
      _sum: { monto: true }
    }),
    commissionRows(year, month)
  ]);
  const commissionByVendor = new Map(commissions.map((row) => [row.vendor.id, row]));
  const balanceByVendor = new Map<string, number>();
  const periodByVendor = new Map<string, { aportes: number; retiros: number; ajustes: number }>();
  for (const row of movements) {
    const amount = Number(row._sum.monto ?? 0);
    const sign = row.tipo === CuentaComercialTipo.RETIRO ? -1 : 1;
    balanceByVendor.set(row.vendedorId, Number(((balanceByVendor.get(row.vendedorId) ?? 0) + amount * sign).toFixed(2)));
  }
  for (const row of periodMovements) {
    const current = periodByVendor.get(row.vendedorId) ?? { aportes: 0, retiros: 0, ajustes: 0 };
    const amount = Number(row._sum.monto ?? 0);
    if (row.tipo === CuentaComercialTipo.APORTE) current.aportes += amount;
    if (row.tipo === CuentaComercialTipo.RETIRO) current.retiros += amount;
    if (row.tipo === CuentaComercialTipo.AJUSTE) current.ajustes += amount;
    periodByVendor.set(row.vendedorId, current);
  }
  return vendors.map((vendor) => {
    const period = periodByVendor.get(vendor.id) ?? { aportes: 0, retiros: 0, ajustes: 0 };
    const commission = commissionByVendor.get(vendor.id);
    const comisionTotal = commission?.comisionTotal ?? 0;
    return {
      vendedorId: vendor.id,
      vendedor: vendor.nombre,
      activo: vendor.activo,
      saldoCuenta: balanceByVendor.get(vendor.id) ?? 0,
      aportesMes: period.aportes,
      retirosMes: period.retiros,
      ajustesMes: period.ajustes,
      ventasTotal: commission?.ventasTotal ?? 0,
      boletasTotal: commission?.boletasTotal ?? 0,
      porcentaje: commission?.porcentaje ?? Number(vendor.porcentajeComision),
      comisionTotal,
      comisionNeta: Math.max(Number((comisionTotal - period.retiros).toFixed(2)), 0),
      excedenteRetiros: Math.max(Number((period.retiros - comisionTotal).toFixed(2)), 0)
    };
  });
}


vendorsRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const activo = String(req.query.activo ?? "");
  const where = activo === "true" ? { activo: true } : activo === "false" ? { activo: false } : {};
  const [items, total] = await Promise.all([
    prisma.vendedor.findMany({ where, skip, take, orderBy: { nombre: "asc" } }),
    prisma.vendedor.count({ where })
  ]);
  const stats = await prisma.remito.groupBy({
    by: ["vendedorId"],
    where: { estado: "ACTIVO", vendedorId: { in: items.map((item) => item.id) } },
    _sum: { total: true },
    _count: { _all: true }
  });
  const statsByVendor = new Map(stats.map((row) => [row.vendedorId, row]));
  res.json({
    items: items.map((vendor) => {
      const row = statsByVendor.get(vendor.id);
      const ventasTotal = Number(row?._sum.total ?? 0);
      const comisionTotal = ventasTotal * Number(vendor.porcentajeComision) / 100;
      return { ...vendor, ventasTotal, boletasTotal: row?._count._all ?? 0, comisionTotal };
    }),
    total,
    page,
    pageSize
  });
});


vendorsRouter.get("/comisiones/gastos", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const { year, month, key } = periodFromQuery(req.query);
  const rows = await commercialAccountRows(year, month);
  const comprobantes = rows.map((row) => `COMISION-${key}-${row.vendedorId}`);
  const existing = await prisma.gasto.findMany({ where: { comprobante: { in: comprobantes } } });
  const existingByComprobante = new Map(existing.map((expense) => [expense.comprobante, expense]));
  res.json({
    year,
    month,
    items: rows.map((row) => {
      const comprobante = `COMISION-${key}-${row.vendedorId}`;
      return { ...row, gastoId: existingByComprobante.get(comprobante)?.id ?? null };
    })
  });
});

vendorsRouter.post("/comisiones/gastos", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const { year, month, end, key } = periodFromQuery(req.body ?? {});
  const rows = await commercialAccountRows(year, month);
  const positiveRows = rows.filter((row) => row.comisionNeta > 0);
  const synced = [];
  for (const row of positiveRows) {
    const comprobante = `COMISION-${key}-${row.vendedorId}`;
    const descripcion = `Comision ${key} - ${row.vendedor}`;
    const observaciones = `${row.boletasTotal} boleta${row.boletasTotal === 1 ? "" : "s"} activa${row.boletasTotal === 1 ? "" : "s"} por ${row.porcentaje}% de comision sobre ventas ${row.ventasTotal.toFixed(2)}. Retiros descontados: ${row.retirosMes.toFixed(2)}`;
    const existing = await prisma.gasto.findFirst({ where: { comprobante } });
    const gasto = existing
      ? await prisma.gasto.update({ where: { id: existing.id }, data: { fecha: end, categoria: "SUELDOS", descripcion, monto: row.comisionNeta, metodoPago: MetodoPago.EFECTIVO, observaciones } })
      : await prisma.gasto.create({ data: { fecha: end, categoria: "SUELDOS", descripcion, monto: row.comisionNeta, metodoPago: MetodoPago.EFECTIVO, comprobante, observaciones, usuarioId: req.user!.id } });
    synced.push({ gastoId: gasto.id, vendedor: row.vendedor, monto: row.comisionNeta, action: existing ? "updated" : "created" });
  }
  await audit({
    usuarioId: req.user!.id,
    modulo: "Gastos",
    accion: "CREAR",
    entidad: "Gasto",
    descripcion: `Registró comisiones ${key} como gastos`,
    cambios: { periodo: key, comisiones: synced.length, total: synced.reduce((sum, item) => sum + item.monto, 0) }
  });
  res.json({ year, month, created: synced.filter((item) => item.action === "created").length, updated: synced.filter((item) => item.action === "updated").length, total: synced.reduce((sum, item) => sum + item.monto, 0), items: synced });
});

vendorsRouter.get("/cuenta/resumen", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const { year, month } = periodFromQuery(req.query);
  const [items, movimientos] = await Promise.all([
    commercialAccountRows(year, month),
    prisma.cuentaComercialMovimiento.findMany({
      take: 80,
      include: { vendedor: true, usuario: { select: { nombre: true } } },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }]
    })
  ]);
  res.json({ year, month, items, movimientos });
});

vendorsRouter.post("/cuenta/movimientos", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = cuentaComercialMovimientoSchema.parse(req.body);
  if (Number(input.monto) <= 0) fail(422, "MONTO_INVALIDO", "El monto debe ser mayor a cero");
  const vendedor = await prisma.vendedor.findUnique({ where: { id: input.vendedorId } });
  if (!vendedor) fail(404, "VENDEDOR_NO_ENCONTRADO", "Vendedor no encontrado");
  const movimiento = await prisma.cuentaComercialMovimiento.create({ data: { ...input, usuarioId: req.user!.id }, include: { vendedor: true, usuario: { select: { nombre: true } } } });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "CREAR",
    entidad: "Cuenta comercial",
    entidadId: movimiento.id,
    descripcion: `${input.tipo === "APORTE" ? "Registró aporte" : input.tipo === "RETIRO" ? "Registró retiro" : "Registró ajuste"} de ${vendedor.nombre}`,
    cambios: { despues: movimiento }
  });
  res.status(201).json(movimiento);
});

vendorsRouter.delete("/cuenta/movimientos/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const movimiento = await prisma.cuentaComercialMovimiento.delete({ where: { id: String(req.params.id) }, include: { vendedor: true } });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "ELIMINAR",
    entidad: "Cuenta comercial",
    entidadId: movimiento.id,
    descripcion: `Eliminó movimiento de cuenta de ${movimiento.vendedor.nombre}`,
    cambios: { antes: movimiento }
  });
  res.status(204).send();
});

vendorsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const vendedor = await prisma.vendedor.findUnique({
    where: { id },
    include: {
      remitos: {
        where: { estado: "ACTIVO" },
        include: { cliente: true, items: true },
        orderBy: { fecha: "desc" },
        take: 100
      }
    }
  });
  if (!vendedor) return res.status(404).json({ code: "VENDEDOR_NO_ENCONTRADO", message: "Vendedor no encontrado" });
  const ventasTotal = vendedor.remitos.reduce((sum, remito) => sum + Number(remito.total), 0);
  const comisionTotal = ventasTotal * Number(vendedor.porcentajeComision) / 100;
  const clientes = new Set(vendedor.remitos.map((remito) => remito.clienteId));
  res.json({
    ...vendedor,
    ventasTotal,
    comisionTotal,
    boletasTotal: vendedor.remitos.length,
    clientesTotal: clientes.size
  });
});

vendorsRouter.post("/", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = vendedorSchema.parse(req.body);
  const vendedor = await prisma.vendedor.create({ data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "CREAR",
    entidad: "Vendedor",
    entidadId: vendedor.id,
    descripcion: `Creó el vendedor ${vendedor.nombre}`,
    cambios: { despues: vendedor }
  });
  res.status(201).json(vendedor);
});

vendorsRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = vendedorSchema.partial().parse(req.body);
  const before = await prisma.vendedor.findUnique({ where: { id: String(req.params.id) } });
  if (!before) fail(404, "VENDEDOR_NO_ENCONTRADO", "Vendedor no encontrado");
  const vendedor = await prisma.vendedor.update({ where: { id: String(req.params.id) }, data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "EDITAR",
    entidad: "Vendedor",
    entidadId: vendedor.id,
    descripcion: `Editó el vendedor ${vendedor.nombre}`,
    cambios: diffFields(before, vendedor, ["nombre", "porcentajeComision", "activo"])
  });
  res.json(vendedor);
});
