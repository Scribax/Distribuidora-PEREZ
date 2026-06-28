import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { MetodoPago, PagoEstado, Prisma, RemitoEstado, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { remitoSchema, remitoUpdateSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { adjustProductStock, aggregateItems, ensureActiveProducts } from "../lib/stock.js";

export const remittancesRouter = Router();
remittancesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandLogoPath = path.resolve(__dirname, "../brand-logo.png");

function normalizePayment(total: number, montoPagado: number, pagoEstado?: PagoEstado) {
  const paid = Math.min(Math.max(montoPagado, 0), total);
  if (pagoEstado) return { montoPagado: paid, pagoEstado };
  if (paid <= 0) return { montoPagado: paid, pagoEstado: PagoEstado.PENDIENTE };
  if (paid >= total) return { montoPagado: paid, pagoEstado: PagoEstado.PAGADA };
  return { montoPagado: paid, pagoEstado: PagoEstado.PARCIAL };
}

function totalWithDiscount(subtotal: number, descuentoPorcentaje: number) {
  const discount = Math.min(Math.max(descuentoPorcentaje, 0), 100);
  return Number((subtotal * (1 - discount / 100)).toFixed(2));
}

remittancesRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const numero = req.query.numero ? Number(req.query.numero) : undefined;
  const estado = String(req.query.estado ?? "");
  const pagoEstado = String(req.query.pagoEstado ?? "");
  const clienteId = String(req.query.clienteId ?? "");
  const vendedorId = String(req.query.vendedorId ?? "");
  const fechaDesde = req.query.fechaDesde ? new Date(String(req.query.fechaDesde)) : undefined;
  const fechaHasta = req.query.fechaHasta ? new Date(String(req.query.fechaHasta)) : undefined;
  const where: Prisma.RemitoWhereInput = {
    numero,
    estado: estado ? (estado as RemitoEstado) : undefined,
    pagoEstado: pagoEstado ? (pagoEstado as PagoEstado) : undefined,
    clienteId: clienteId || undefined,
    vendedorId: vendedorId || undefined,
    fecha: fechaDesde || fechaHasta ? { gte: fechaDesde, lte: fechaHasta } : undefined
  };
  const [items, total] = await Promise.all([
    prisma.remito.findMany({ where, skip, take, include: { cliente: true, vendedor: true, items: true }, orderBy: { numero: "desc" } }),
    prisma.remito.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

remittancesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const remito = await prisma.remito.findUnique({
    where: { id },
    include: { cliente: true, vendedor: true, items: true, usuario: { select: { nombre: true } } }
  });
  if (!remito) fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");
  res.json(remito);
});

remittancesRouter.post("/", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = remitoSchema.parse(req.body);
  const remito = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: input.clienteId } });
    if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
    if (!cliente.activo) fail(422, "CLIENTE_INACTIVO", "El cliente está inactivo");
    if (input.vendedorId) {
      const vendedor = await tx.vendedor.findUnique({ where: { id: input.vendedorId } });
      if (!vendedor?.activo) fail(422, "VENDEDOR_INACTIVO", "El vendedor debe existir y estar activo");
    }

    const productos = await ensureActiveProducts(tx, input.items.map((i) => i.productoId));
    const productMap = new Map(productos.map((p) => [p.id, p]));
    const requested = aggregateItems(input.items);
    const insufficient = [...requested.entries()].flatMap(([productoId, cantidad]) => {
      const producto = productMap.get(productoId)!;
      return producto.stockActual < cantidad ? [{ producto: producto.nombre, stock_disponible: producto.stockActual, cantidad_solicitada: cantidad }] : [];
    });
    if (insufficient.length) fail(422, "STOCK_INSUFICIENTE", "No hay stock suficiente para los productos solicitados", insufficient);

    const items = input.items.map((item) => {
      const producto = productMap.get(item.productoId)!;
      const precio = Number(input.listaPrecios === "MAYORISTA" ? producto.precioMayorista : producto.precioMinorista);
      return {
        productoId: item.productoId,
        codigoProducto: producto.codigoInterno,
        nombreProducto: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: precio,
        subtotal: precio * item.cantidad
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const total = totalWithDiscount(subtotal, input.descuentoPorcentaje);
    const payment = normalizePayment(total, input.montoPagado, input.pagoEstado as PagoEstado | undefined);
    const created = await tx.remito.create({
      data: {
        clienteId: input.clienteId,
        vendedorId: input.vendedorId || null,
        listaPrecios: input.listaPrecios,
        saldoClienteAlEmitir: cliente.saldoPendiente,
        subtotal,
        descuentoPorcentaje: input.descuentoPorcentaje,
        total,
        montoPagado: payment.montoPagado,
        pagoEstado: payment.pagoEstado,
        metodoPago: input.metodoPago as MetodoPago | null,
        fecha: input.fecha,
        usuarioId: req.user!.id,
        items: { create: items }
      },
      include: { items: true, cliente: true }
    });
    for (const item of input.items) {
      await adjustProductStock(tx, {
        productoId: item.productoId,
        delta: -item.cantidad,
        tipo: "REMITO",
        usuarioId: req.user!.id,
        referenciaId: created.id,
        referenciaTipo: "Remito"
      });
    }
    return created;
  });
  res.status(201).json(remito);
});

remittancesRouter.put("/:id", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const input = remitoUpdateSchema.parse(req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const remito = await tx.remito.findUnique({ where: { id }, include: { items: true } });
    if (!remito) fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");
    if (remito.estado === "CANCELADO") fail(422, "REMITO_CANCELADO", "No se puede editar un remito cancelado");
    if (input.vendedorId) {
      const vendedor = await tx.vendedor.findUnique({ where: { id: input.vendedorId } });
      if (!vendedor?.activo) fail(422, "VENDEDOR_INACTIVO", "El vendedor debe existir y estar activo");
    }

    let subtotal = Number(remito.subtotal);
    let total = Number(remito.total);
    if (input.items) {
      const productos = await ensureActiveProducts(tx, input.items.map((i) => i.productoId));
      const productMap = new Map(productos.map((p) => [p.id, p]));
      const previous = aggregateItems(remito.items);
      const next = aggregateItems(input.items);
      const insufficient = [...next.entries()].flatMap(([productoId, cantidad]) => {
        const producto = productMap.get(productoId)!;
        const delta = cantidad - (previous.get(productoId) ?? 0);
        return delta > producto.stockActual ? [{ producto: producto.nombre, stock_disponible: producto.stockActual, cantidad_solicitada: delta }] : [];
      });
      if (insufficient.length) fail(422, "STOCK_INSUFICIENTE", "No hay stock suficiente para aumentar las cantidades", insufficient);

      await tx.remitoItem.deleteMany({ where: { remitoId: remito.id } });
      const newItems = input.items.map((item) => {
        const producto = productMap.get(item.productoId)!;
        const precio = Number(remito.listaPrecios === "MAYORISTA" ? producto.precioMayorista : producto.precioMinorista);
        return {
          remitoId: remito.id,
          productoId: item.productoId,
          codigoProducto: producto.codigoInterno,
          nombreProducto: producto.nombre,
          cantidad: item.cantidad,
          precioUnitario: precio,
          subtotal: precio * item.cantidad
        };
      });
      await tx.remitoItem.createMany({ data: newItems });
      const touched = new Set([...previous.keys(), ...next.keys()]);
      for (const productoId of touched) {
        const delta = (previous.get(productoId) ?? 0) - (next.get(productoId) ?? 0);
        if (delta !== 0) {
          await adjustProductStock(tx, {
            productoId,
            delta,
            tipo: "REMITO",
            usuarioId: req.user!.id,
            referenciaId: remito.id,
            referenciaTipo: "Remito",
            motivo: "Edición de remito activo"
          });
        }
      }
      subtotal = newItems.reduce((sum, item) => sum + item.subtotal, 0);
      total = totalWithDiscount(subtotal, input.descuentoPorcentaje ?? Number(remito.descuentoPorcentaje));
    }
    if (input.descuentoPorcentaje !== undefined && !input.items) {
      total = totalWithDiscount(subtotal, input.descuentoPorcentaje);
    }
    const payment = normalizePayment(total, input.montoPagado ?? Number(remito.montoPagado), input.pagoEstado as PagoEstado | undefined);
    return tx.remito.update({
      where: { id: remito.id },
      data: {
        total,
        subtotal,
        descuentoPorcentaje: input.descuentoPorcentaje ?? undefined,
        montoPagado: payment.montoPagado,
        pagoEstado: payment.pagoEstado,
        metodoPago: input.metodoPago === undefined ? undefined : input.metodoPago as MetodoPago | null,
        vendedorId: input.vendedorId === undefined ? undefined : input.vendedorId || null
      },
      include: { items: true, cliente: true, vendedor: true }
    });
  });
  res.json(updated);
});

remittancesRouter.post("/:id/cancelar", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const remito = await prisma.remito.findUnique({ where: { id }, include: { items: true } });
  if (!remito) fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");
  if (remito.estado === "CANCELADO") fail(422, "REMITO_CANCELADO", "El remito ya está cancelado");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.remito.update({ where: { id: remito.id }, data: { estado: "CANCELADO" }, include: { items: true } });
    for (const item of updated.items) {
      await adjustProductStock(tx, {
        productoId: item.productoId,
        delta: item.cantidad,
        tipo: "CANCELACION_REMITO",
        usuarioId: req.user!.id,
        referenciaId: remito.id,
        referenciaTipo: "Remito",
        motivo: "Cancelación de remito"
      });
    }
  });
  res.status(204).send();
});

remittancesRouter.get("/:id/pdf", async (req, res) => {
  const id = String(req.params.id);
  const remito = await prisma.remito.findUnique({
    where: { id },
    include: { cliente: true, vendedor: true, items: true }
  });
  if (!remito) fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="boleta-${remito.numero}.pdf"`);
  const doc = new PDFDocument({ size: [595.28, 420], margin: 24 });
  doc.pipe(res);
  const money = (value: unknown) => `$${Number(value).toFixed(2)}`;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = 24;
  const right = left + pageWidth;

  doc.image(brandLogoPath, left, 18, { width: 118 });
  doc.fontSize(15).fillColor("#111111").text(`Boleta Nro. ${remito.numero}`, right - 170, 24, { width: 170, align: "right" });
  doc.fontSize(9).fillColor("#555555").text(`Fecha: ${remito.fecha.toISOString().slice(0, 10)}`, right - 170, 46, { width: 170, align: "right" });
  doc.text(`Estado: ${remito.estado === "ACTIVO" ? "Activo" : "Cancelado"}`, right - 170, 60, { width: 170, align: "right" });
  doc.moveTo(left, 82).lineTo(right, 82).strokeColor("#166534").stroke();

  doc.fontSize(10).fillColor("#111111").text(`Cliente: ${remito.cliente.nombre}`, left, 96, { width: 250 });
  doc.text(`Dirección: ${remito.cliente.direccion ?? "-"}`, left, 112, { width: 250 });
  doc.text(`Vendedor: ${remito.vendedor?.nombre ?? "-"}`, left + 285, 96, { width: 150 });
  doc.text(`Pago: ${remito.pagoEstado}`, left + 285, 112, { width: 150 });
  doc.fillColor("#166534").fontSize(11).text(`Saldo pendiente: ${money(remito.saldoClienteAlEmitir)}`, left, 134, { width: 250 });
  doc.fillColor("#111111").fontSize(9).text(`Abonado: ${money(remito.montoPagado)}${remito.metodoPago ? ` · ${remito.metodoPago}` : ""}`, left + 285, 134, { width: 230 });

  const startX = left;
  let y = 164;
  doc.fontSize(8).fillColor("#496054");
  doc.text("Código", startX, y, { width: 55 });
  doc.text("Producto", startX + 60, y, { width: 220 });
  doc.text("Cant.", startX + 285, y, { width: 40, align: "right" });
  doc.text("Unit.", startX + 335, y, { width: 70, align: "right" });
  doc.text("Subtotal", startX + 415, y, { width: 90, align: "right" });
  y += 18;
  doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).strokeColor("#d9e2dd").stroke();
  doc.fillColor("#111111").fontSize(8);
  for (const item of remito.items) {
    if (y > 320) {
      doc.addPage();
      y = 28;
    }
    doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).strokeColor("#edf1ee").stroke();
    doc.text(item.codigoProducto, startX, y, { width: 55 });
    doc.text(item.nombreProducto, startX + 60, y, { width: 220 });
    doc.text(String(item.cantidad), startX + 285, y, { width: 40, align: "right" });
    doc.text(money(item.precioUnitario), startX + 335, y, { width: 70, align: "right" });
    doc.text(money(item.subtotal), startX + 415, y, { width: 90, align: "right" });
    y += 16;
  }
  doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor("#d9e2dd").stroke();
  const discountAmount = Number(remito.subtotal) - Number(remito.total);
  doc.fontSize(9).fillColor("#111111").text(`Subtotal: ${money(remito.subtotal)}`, right - 170, y + 10, { width: 170, align: "right" });
  doc.text(`Descuento ${Number(remito.descuentoPorcentaje)}%: -${money(discountAmount)}`, right - 170, y + 25, { width: 170, align: "right" });
  doc.fontSize(14).fillColor("#166534").text(`Total: ${money(remito.total)}`, right - 170, y + 42, { width: 170, align: "right" });
  doc.fillColor("#111111").fontSize(7).text("Documento interno sin validez fiscal.", left, doc.page.height - 28, { align: "center", width: pageWidth });
  doc.end();
});
