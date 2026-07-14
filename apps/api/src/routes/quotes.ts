import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { cotizacionSchema } from "../lib/schemas.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { ensureActiveProducts } from "../lib/stock.js";

export const quotesRouter = Router();
quotesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandLogoPath = path.resolve(__dirname, "../brand-logo.png");

function totalWithDiscount(subtotal: number, descuentoPorcentaje: number) {
  const discount = Math.min(Math.max(descuentoPorcentaje, 0), 100);
  return Number((subtotal * (1 - discount / 100)).toFixed(2));
}

// Genera una cotización en PDF SIN persistir nada: no toca stock, saldo, ni crea
// registros. Usa la lista de precios cargada al momento. Pensado para presupuestar
// sin el problema de descontar stock cuando varias personas trabajan en paralelo.
quotesRouter.post("/pdf", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = cotizacionSchema.parse(req.body);
  const productos = await ensureActiveProducts(prisma, input.items.map((i) => i.productoId));
  const productMap = new Map(productos.map((p) => [p.id, p]));

  const items = input.items.map((item) => {
    const producto = productMap.get(item.productoId)!;
    const precio = Number(input.listaPrecios === "MAYORISTA" ? producto.precioMayorista : producto.precioMinorista);
    return {
      codigoProducto: producto.codigoInterno,
      nombreProducto: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: precio,
      subtotal: precio * item.cantidad
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = totalWithDiscount(subtotal, input.descuentoPorcentaje);
  const discountAmount = Number((subtotal - total).toFixed(2));

  let clienteNombre = input.clienteNombre;
  if (input.clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: input.clienteId } });
    if (cliente) clienteNombre = cliente.nombre;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="cotizacion.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  doc.pipe(res);
  const money = (value: unknown) => `$${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const right = left + pageWidth;
  const startX = left;
  const bottomLimit = doc.page.height - 58;
  const hoy = new Date().toISOString().slice(0, 10);

  const drawItemsHeader = (headerY: number) => {
    doc.rect(startX, headerY - 5, pageWidth, 18).fillAndStroke("#f2f2f2", "#cccccc");
    doc.fontSize(8.3).fillColor("#333333");
    doc.text("Código", startX + 6, headerY, { width: 64 });
    doc.text("Producto", startX + 78, headerY, { width: 220 });
    doc.text("Cant.", startX + 308, headerY, { width: 42, align: "right" });
    doc.text("Unit.", startX + 365, headerY, { width: 76, align: "right" });
    doc.text("Subtotal", startX + 456, headerY, { width: 76, align: "right" });
    return headerY + 21;
  };
  const drawFooter = () => {
    const footerY = doc.page.height - 38;
    doc.moveTo(left, footerY - 12).lineTo(right, footerY - 12).dash(3, { space: 4 }).strokeColor("#b9c7bf").stroke().undash();
    doc.fillColor("#777777").fontSize(7).text("Cotización sin validez fiscal. Precios sujetos a modificación y disponibilidad de stock.", left, footerY, { align: "center", width: pageWidth, lineBreak: false });
  };
  const drawMainHeader = () => {
    doc.image(brandLogoPath, left, 22, { width: 118 });
    doc.fontSize(17).fillColor("#111111").text("Cotización", right - 190, 29, { width: 190, align: "right" });
    doc.fontSize(9).fillColor("#555555").text(`Fecha: ${hoy}`, right - 190, 53, { width: 190, align: "right" });
    doc.text(`Lista: ${input.listaPrecios === "MAYORISTA" ? "Mayorista" : "Minorista"}`, right - 190, 67, { width: 190, align: "right" });
    doc.moveTo(left, 91).lineTo(right, 91).strokeColor("#111111").lineWidth(1.2).stroke();

    doc.roundedRect(left, 106, pageWidth, 44, 4).strokeColor("#d9e2dd").lineWidth(0.8).stroke();
    doc.fontSize(9.5).fillColor("#111111").text("Cliente", left + 10, 118, { width: 80 });
    doc.fontSize(10.5).text(clienteNombre, left + 70, 117, { width: 260 });
    if (input.observaciones) {
      doc.fontSize(9).fillColor("#555555").text(input.observaciones, left + 70, 133, { width: 440, height: 12, ellipsis: true });
    }
    return drawItemsHeader(164);
  };
  const drawContinuationHeader = () => {
    doc.fontSize(14).fillColor("#111111").text("Cotización", left, 32, { width: 220 });
    doc.fontSize(9).fillColor("#555555").text(`${clienteNombre} · continuación`, left, 52, { width: pageWidth });
    doc.moveTo(left, 72).lineTo(right, 72).strokeColor("#111111").lineWidth(1.2).stroke();
    return drawItemsHeader(92);
  };

  let y = drawMainHeader();
  for (const item of items) {
    doc.fontSize(8.5);
    const productHeight = doc.heightOfString(item.nombreProducto, { width: 220 });
    const rowHeight = Math.max(18, productHeight + 6);
    if (y + rowHeight > bottomLimit - 92) {
      drawFooter();
      doc.addPage();
      y = drawContinuationHeader();
    }
    doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).strokeColor("#edf1ee").stroke();
    doc.fillColor("#111111").fontSize(8.5);
    doc.text(item.codigoProducto, startX + 6, y, { width: 64 });
    doc.text(item.nombreProducto, startX + 78, y, { width: 220 });
    doc.text(String(item.cantidad), startX + 308, y, { width: 42, align: "right" });
    doc.text(money(item.precioUnitario), startX + 365, y, { width: 76, align: "right" });
    doc.text(money(item.subtotal), startX + 456, y, { width: 76, align: "right" });
    y += rowHeight;
  }
  doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor("#d9e2dd").stroke();
  if (y + 92 > bottomLimit) {
    drawFooter();
    doc.addPage();
    y = 82;
    doc.fontSize(14).fillColor("#111111").text("Cotización", left, 32, { width: 220 });
    doc.fontSize(9).fillColor("#555555").text(`${clienteNombre} · resumen`, left, 52, { width: pageWidth });
    doc.moveTo(left, 72).lineTo(right, 72).strokeColor("#111111").lineWidth(1.2).stroke();
  }
  const totalsY = y + 10;
  doc.roundedRect(right - 218, totalsY, 218, 72, 4).fillAndStroke("#fffefa", "#d9e2dd");
  doc.fontSize(8.8).fillColor("#555555").text("Subtotal", right - 205, totalsY + 10, { width: 90 });
  doc.fillColor("#111111").text(money(subtotal), right - 105, totalsY + 10, { width: 92, align: "right" });
  doc.fillColor("#555555").text(`Descuento ${input.descuentoPorcentaje}%`, right - 205, totalsY + 27, { width: 100 });
  doc.fillColor("#111111").text(`-${money(discountAmount)}`, right - 105, totalsY + 27, { width: 92, align: "right" });
  doc.moveTo(right - 205, totalsY + 45).lineTo(right - 12, totalsY + 45).strokeColor("#d9e2dd").stroke();
  doc.fontSize(14).fillColor("#111111").text("Total", right - 205, totalsY + 51, { width: 70 });
  doc.text(money(total), right - 120, totalsY + 51, { width: 108, align: "right" });

  drawFooter();
  doc.end();
});
