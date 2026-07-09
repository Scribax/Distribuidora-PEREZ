import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Router } from "express";
import { endOfMonth, endOfDay, startOfDay, startOfMonth } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { Rol } from "@prisma/client";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO));

type Column = {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right";
  kind?: "text" | "number" | "currency";
};

function period(req: any) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const start = req.query.fechaDesde ? parseLocalDate(String(req.query.fechaDesde)) : startOfMonth(new Date(year, month - 1, 1));
  const end = req.query.fechaHasta ? parseLocalDate(String(req.query.fechaHasta), true) : endOfMonth(new Date(year, month - 1, 1));
  return { year, month, start, end };
}

function money(value: unknown) {
  return Number(value ?? 0);
}

function parseLocalDate(value: string, end = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return end ? endOfDay(date) : startOfDay(date);
}

function formatCell(value: unknown, column: Column) {
  if (value === null || value === undefined || value === "") return "-";
  if (column.kind === "currency") {
    return Number(value).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  }
  if (column.kind === "number") {
    return Number(value).toLocaleString("es-AR");
  }
  return String(value);
}

async function sendReport(res: any, filename: string, title: string, columns: Column[], rows: Record<string, any>[], format: string) {
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? 18
    }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle" };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length }
    };
    columns.forEach((column, index) => {
      const excelColumn = sheet.getColumn(index + 1);
      if (column.kind === "currency") excelColumn.numFmt = '"$" #,##0.00;[Red]-"$" #,##0.00';
      if (column.kind === "number") excelColumn.numFmt = "#,##0";
      if (column.align === "right" || column.kind === "currency" || column.kind === "number") {
        excelColumn.alignment = { horizontal: "right" };
      }
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  const doc = new PDFDocument({ margin: 42, size: "A4", layout: "landscape" });
  doc.pipe(res);
  const left = 42;
  const tableWidth = doc.page.width - left * 2;
  const totalWidth = columns.reduce((sum, col) => sum + (col.width ?? 18), 0);
  const colWidths = columns.map((col) => ((col.width ?? 18) / totalWidth) * tableWidth);
  const colX = columns.reduce<number[]>((positions, _col, index) => {
    positions.push(index === 0 ? left : positions[index - 1] + colWidths[index - 1]);
    return positions;
  }, []);

  const drawHeader = () => {
    doc.fontSize(16).fillColor("#111111").text(title, left, 42);
    const headerY = doc.y + 16;
    doc.fontSize(8).fillColor("#555555");
    columns.forEach((col, index) => {
      doc.text(col.header, colX[index], headerY, { width: colWidths[index] - 6, align: col.align ?? "left" });
    });
    doc.moveTo(left, headerY + 14).lineTo(doc.page.width - left, headerY + 14).strokeColor("#dddddd").stroke();
    doc.fillColor("#111111");
    return headerY + 22;
  };

  let y = drawHeader();
  for (const row of rows) {
    doc.fontSize(8);
    const values = columns.map((col) => formatCell(row[col.key], col));
    const rowHeight = Math.max(16, ...values.map((value, index) => doc.heightOfString(value, { width: colWidths[index] - 6 }))) + 6;
    if (y + rowHeight > doc.page.height - 42) {
      doc.addPage();
      y = drawHeader();
    }
    columns.forEach((col, index) => {
      doc.text(values[index], colX[index], y, { width: colWidths[index] - 6, align: col.align ?? "left" });
    });
    y += rowHeight;
  }
  doc.end();
}

reportsRouter.get("/clientes", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const clients = await prisma.cliente.findMany({
    where: { saldoPendiente: { gt: 0 } },
    orderBy: { nombre: "asc" }
  });
  const rows = clients.map((client) => ({
    nombre: client.nombre,
    empresa: client.empresa ?? "",
    telefono: client.telefono ?? "",
    email: client.email ?? "",
    saldo: money(client.saldoPendiente),
    estado: client.activo ? "Activo" : "Inactivo"
  }));
  await sendReport(res, "clientes-saldo-pendiente", "Clientes con saldo pendiente", [
    { header: "Cliente", key: "nombre", width: 28 },
    { header: "Empresa", key: "empresa", width: 24 },
    { header: "Teléfono", key: "telefono", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Saldo", key: "saldo", width: 14, align: "right", kind: "currency" },
    { header: "Estado", key: "estado", width: 14 }
  ], rows, format);
});

reportsRouter.get("/ventas", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const { start, end } = period(req);
  const sales = await prisma.remito.findMany({
    where: { fecha: { gte: start, lte: end } },
    include: { cliente: true, vendedor: true, items: true },
    orderBy: { fecha: "desc" }
  });
  const rows = sales.map((sale) => {
    // Los remitos cancelados se muestran (con su estado) pero no aportan a las
    // métricas de rentabilidad: ganancia y comisión van en cero para no inflar totales.
    const anulado = sale.estado !== "ACTIVO";
    const comision = !anulado && sale.vendedor ? money(sale.total) * Number(sale.vendedor.porcentajeComision) / 100 : 0;
    const costoVendido = sale.items.reduce((sum, item) => sum + money(item.costoTotal), 0);
    const ganancia = anulado ? 0 : money(sale.total) - costoVendido;
    return {
      numero: sale.numero,
      fecha: sale.fecha.toISOString().slice(0, 10),
      cliente: sale.cliente.nombre,
      vendedor: sale.vendedor?.nombre ?? "",
      total: money(sale.total),
      pagado: money(sale.montoPagado),
      pago: sale.pagoEstado,
      metodo: sale.metodoPago ?? "",
      costoVendido: Number((anulado ? 0 : costoVendido).toFixed(2)),
      ganancia: Number(ganancia.toFixed(2)),
      comision: Number(comision.toFixed(2)),
      estado: sale.estado
    };
  });
  await sendReport(res, "ventas", "Ventas", [
    { header: "Nro", key: "numero", width: 10 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Total", key: "total", width: 14, align: "right", kind: "currency" },
    { header: "Pagado", key: "pagado", width: 14, align: "right", kind: "currency" },
    { header: "Pago", key: "pago", width: 14 },
    { header: "Método", key: "metodo", width: 16 },
    { header: "Costo vendido", key: "costoVendido", width: 16, align: "right", kind: "currency" },
    { header: "Ganancia", key: "ganancia", width: 16, align: "right", kind: "currency" },
    { header: "Comisión", key: "comision", width: 14, align: "right", kind: "currency" },
    { header: "Estado", key: "estado", width: 14 }
  ], rows, format);
});

reportsRouter.get("/gastos", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const { start, end } = period(req);
  const expenses = await prisma.gasto.findMany({ where: { fecha: { gte: start, lte: end } }, include: { usuario: { select: { nombre: true } } }, orderBy: { fecha: "desc" } });
  const rows = expenses.map((expense) => ({
    fecha: expense.fecha.toISOString().slice(0, 10),
    categoria: expense.categoria,
    descripcion: expense.descripcion,
    monto: money(expense.monto),
    metodo: expense.metodoPago ?? "",
    comprobante: expense.comprobante ?? "",
    usuario: expense.usuario.nombre
  }));
  await sendReport(res, "gastos", "Gastos", [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Categoría", key: "categoria", width: 18 },
    { header: "Descripción", key: "descripcion", width: 34 },
    { header: "Monto", key: "monto", width: 14, align: "right", kind: "currency" },
    { header: "Método", key: "metodo", width: 16 },
    { header: "Comprobante", key: "comprobante", width: 18 },
    { header: "Usuario", key: "usuario", width: 18 }
  ], rows, format);
});

reportsRouter.get("/compras", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const { start, end } = period(req);
  const purchases = await prisma.compra.findMany({ where: { fecha: { gte: start, lte: end } }, include: { items: true }, orderBy: { fecha: "desc" } });
  const rows = purchases.map((purchase) => ({
    proveedor: purchase.proveedorNombre,
    fecha: purchase.fecha.toISOString().slice(0, 10),
    total: money(purchase.total),
    items: purchase.items.length,
    estado: purchase.estado
  }));
  await sendReport(res, "compras", "Compras", [
    { header: "Proveedor", key: "proveedor", width: 30 },
    { header: "Fecha", key: "fecha", width: 16 },
    { header: "Total", key: "total", width: 16, align: "right", kind: "currency" },
    { header: "Ítems", key: "items", width: 12, align: "right", kind: "number" },
    { header: "Estado", key: "estado", width: 16 }
  ], rows, format);
});

reportsRouter.get("/productos", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const products = await prisma.producto.findMany({ include: { categoria: true }, orderBy: { nombre: "asc" } });
  const rows = products.map((product) => ({
    codigo: product.codigoInterno,
    producto: product.nombre,
    categoria: product.categoria.nombre,
    stock: product.stockActual,
    minimo: product.stockMinimo,
    costo: money(product.costo),
    mayorista: money(product.precioMayorista),
    minorista: money(product.precioMinorista),
    estado: product.activo ? "Activo" : "Inactivo"
  }));
  await sendReport(res, "productos", "Productos", [
    { header: "Código", key: "codigo", width: 14 },
    { header: "Producto", key: "producto", width: 32 },
    { header: "Categoría", key: "categoria", width: 22 },
    { header: "Stock", key: "stock", width: 10, align: "right", kind: "number" },
    { header: "Mínimo", key: "minimo", width: 10, align: "right", kind: "number" },
    { header: "Costo", key: "costo", width: 14, align: "right", kind: "currency" },
    { header: "Mayorista", key: "mayorista", width: 14, align: "right", kind: "currency" },
    { header: "Minorista", key: "minorista", width: 14, align: "right", kind: "currency" },
    { header: "Estado", key: "estado", width: 14 }
  ], rows, format);
});

reportsRouter.get("/auditoria", async (req, res) => {
  const { page, pageSize, skip, take } = await import("../lib/validation.js").then(({ pageArgs }) => pageArgs(req.query));
  const modulo = String(req.query.modulo ?? "");
  const accion = String(req.query.accion ?? "");
  const usuarioId = String(req.query.usuarioId ?? "");
  const entidad = String(req.query.entidad ?? "");
  const fechaDesde = req.query.fechaDesde ? parseLocalDate(String(req.query.fechaDesde)) : undefined;
  const fechaHasta = req.query.fechaHasta ? parseLocalDate(String(req.query.fechaHasta), true) : undefined;
  const where = {
    modulo: modulo || undefined,
    accion: accion || undefined,
    usuarioId: usuarioId || undefined,
    entidad: entidad || undefined,
    createdAt: fechaDesde || fechaHasta ? { gte: fechaDesde, lte: fechaHasta } : undefined
  };
  const [items, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      include: { usuario: { select: { nombre: true, email: true, rol: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, nombre: true, email: true }, orderBy: { nombre: "asc" } })
  ]);
  res.json({ items, total, page, pageSize, users });
});
