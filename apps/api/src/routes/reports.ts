import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Router } from "express";
import { endOfMonth, startOfMonth } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { Rol } from "@prisma/client";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO));

type Column = { header: string; key: string; width?: number };

function period(req: any) {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const start = req.query.fechaDesde ? new Date(String(req.query.fechaDesde)) : startOfMonth(new Date(year, month - 1, 1));
  const end = req.query.fechaHasta ? new Date(String(req.query.fechaHasta)) : endOfMonth(new Date(year, month - 1, 1));
  return { year, month, start, end };
}

function money(value: unknown) {
  return Number(value ?? 0);
}

async function sendReport(res: any, filename: string, title: string, columns: Column[], rows: Record<string, any>[], format: string) {
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.columns = columns;
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
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
  doc.fontSize(16).text(title);
  doc.moveDown();
  const tableWidth = doc.page.width - 84;
  const colWidth = tableWidth / columns.length;
  let y = doc.y;
  doc.fontSize(8).fillColor("#555555");
  columns.forEach((col, index) => doc.text(col.header, 42 + index * colWidth, y, { width: colWidth - 6 }));
  y += 18;
  doc.moveTo(42, y - 4).lineTo(doc.page.width - 42, y - 4).strokeColor("#dddddd").stroke();
  doc.fillColor("#111111");
  for (const row of rows) {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 42;
    }
    columns.forEach((col, index) => doc.text(String(row[col.key] ?? "-").slice(0, 45), 42 + index * colWidth, y, { width: colWidth - 6 }));
    y += 16;
  }
  doc.end();
}

reportsRouter.get("/clientes", async (req, res) => {
  const format = String(req.query.format ?? "pdf");
  const clients = await prisma.cliente.findMany({ orderBy: { nombre: "asc" } });
  const rows = clients.map((client) => ({
    nombre: client.nombre,
    empresa: client.empresa ?? "",
    telefono: client.telefono ?? "",
    email: client.email ?? "",
    saldo: money(client.saldoPendiente),
    estado: client.activo ? "Activo" : "Inactivo"
  }));
  await sendReport(res, "clientes-saldos", "Clientes con saldos", [
    { header: "Cliente", key: "nombre", width: 28 },
    { header: "Empresa", key: "empresa", width: 24 },
    { header: "Teléfono", key: "telefono", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Saldo", key: "saldo", width: 14 },
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
    const comision = sale.vendedor ? money(sale.total) * Number(sale.vendedor.porcentajeComision) / 100 : 0;
    const costoVendido = sale.items.reduce((sum, item) => sum + money(item.costoTotal), 0);
    const ganancia = money(sale.total) - costoVendido;
    return {
      numero: sale.numero,
      fecha: sale.fecha.toISOString().slice(0, 10),
      cliente: sale.cliente.nombre,
      vendedor: sale.vendedor?.nombre ?? "",
      total: money(sale.total),
      pagado: money(sale.montoPagado),
      pago: sale.pagoEstado,
      metodo: sale.metodoPago ?? "",
      costoVendido: Number(costoVendido.toFixed(2)),
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
    { header: "Total", key: "total", width: 14 },
    { header: "Pagado", key: "pagado", width: 14 },
    { header: "Pago", key: "pago", width: 14 },
    { header: "Método", key: "metodo", width: 16 },
    { header: "Costo vendido", key: "costoVendido", width: 16 },
    { header: "Ganancia", key: "ganancia", width: 16 },
    { header: "Comisión", key: "comision", width: 14 },
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
    { header: "Monto", key: "monto", width: 14 },
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
    { header: "Total", key: "total", width: 16 },
    { header: "Ítems", key: "items", width: 12 },
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
    { header: "Stock", key: "stock", width: 10 },
    { header: "Mínimo", key: "minimo", width: 10 },
    { header: "Costo", key: "costo", width: 14 },
    { header: "Mayorista", key: "mayorista", width: 14 },
    { header: "Minorista", key: "minorista", width: 14 },
    { header: "Estado", key: "estado", width: 14 }
  ], rows, format);
});
