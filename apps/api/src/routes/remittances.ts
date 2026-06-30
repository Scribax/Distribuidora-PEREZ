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
import { audit, diffFields } from "../lib/audit.js";

export const remittancesRouter = Router();
remittancesRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandLogoPath = path.resolve(__dirname, "../brand-logo.png");

function normalizePayment(total: number, montoPagado: number, pagoEstado?: PagoEstado) {
  const paid = Math.min(Math.max(montoPagado, 0), total);
  if (pagoEstado === PagoEstado.PAGADA) return { montoPagado: total, pagoEstado };
  if (pagoEstado === PagoEstado.PENDIENTE) return { montoPagado: 0, pagoEstado };
  if (pagoEstado === PagoEstado.PARCIAL) {
    if (paid <= 0) return { montoPagado: 0, pagoEstado: PagoEstado.PENDIENTE };
    if (paid >= total) return { montoPagado: total, pagoEstado: PagoEstado.PAGADA };
    return { montoPagado: paid, pagoEstado };
  }
  if (paid <= 0) return { montoPagado: paid, pagoEstado: PagoEstado.PENDIENTE };
  if (paid >= total) return { montoPagado: paid, pagoEstado: PagoEstado.PAGADA };
  return { montoPagado: paid, pagoEstado: PagoEstado.PARCIAL };
}

function totalWithDiscount(subtotal: number, descuentoPorcentaje: number) {
  const discount = Math.min(Math.max(descuentoPorcentaje, 0), 100);
  return Number((subtotal * (1 - discount / 100)).toFixed(2));
}

function remitoDebt(total: number, montoPagado: number) {
  return Number(Math.max(total - montoPagado, 0).toFixed(2));
}

function remitoPending(total: number, montoPagado: number, pagoEstado?: string) {
  if (pagoEstado === PagoEstado.PAGADA) return 0;
  return remitoDebt(total, montoPagado);
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
      const costo = Number(producto.costo);
      return {
        productoId: item.productoId,
        codigoProducto: producto.codigoInterno,
        nombreProducto: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: precio,
        costoUnitario: costo,
        costoTotal: costo * item.cantidad,
        subtotal: precio * item.cantidad
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const total = totalWithDiscount(subtotal, input.descuentoPorcentaje);
    const payment = normalizePayment(total, input.montoPagado, input.pagoEstado as PagoEstado | undefined);
    const pendingDebt = remitoPending(total, payment.montoPagado, payment.pagoEstado);
    const saldoClienteAlEmitir = Number(cliente.saldoPendiente) + pendingDebt;
    const created = await tx.remito.create({
      data: {
        clienteId: input.clienteId,
        vendedorId: input.vendedorId || null,
        listaPrecios: input.listaPrecios,
        saldoClienteAlEmitir,
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
    if (pendingDebt !== 0) {
      await tx.cliente.update({
        where: { id: input.clienteId },
        data: { saldoPendiente: { increment: pendingDebt } }
      });
    }
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
    await audit({
      usuarioId: req.user!.id,
      modulo: "Ventas",
      accion: "CREAR",
      entidad: "Boleta",
      entidadId: created.id,
      descripcion: `Emitió boleta #${created.numero} para ${created.cliente.nombre}`,
      cambios: { despues: created, deudaAgregada: pendingDebt }
    }, tx);
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
        const costo = Number(producto.costo);
        return {
          remitoId: remito.id,
          productoId: item.productoId,
          codigoProducto: producto.codigoInterno,
          nombreProducto: producto.nombre,
          cantidad: item.cantidad,
          precioUnitario: precio,
          costoUnitario: costo,
          costoTotal: costo * item.cantidad,
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
    const previousDebt = remitoPending(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
    const nextDebt = remitoPending(total, payment.montoPagado, payment.pagoEstado);
    const debtDelta = nextDebt - previousDebt;
    if (debtDelta !== 0) {
      await tx.cliente.update({
        where: { id: remito.clienteId },
        data: { saldoPendiente: { increment: debtDelta } }
      });
    }
    const updated = await tx.remito.update({
      where: { id: remito.id },
      data: {
        total,
        subtotal,
        descuentoPorcentaje: input.descuentoPorcentaje ?? undefined,
        saldoClienteAlEmitir: { increment: debtDelta },
        montoPagado: payment.montoPagado,
        pagoEstado: payment.pagoEstado,
        metodoPago: input.metodoPago === undefined ? undefined : input.metodoPago as MetodoPago | null,
        vendedorId: input.vendedorId === undefined ? undefined : input.vendedorId || null
      },
      include: { items: true, cliente: true, vendedor: true }
    });
    await audit({
      usuarioId: req.user!.id,
      modulo: "Ventas",
      accion: "EDITAR",
      entidad: "Boleta",
      entidadId: updated.id,
      descripcion: `Editó boleta #${updated.numero}`,
      cambios: {
        ...diffFields(remito, updated, ["vendedorId", "subtotal", "descuentoPorcentaje", "total", "montoPagado", "pagoEstado", "metodoPago"]),
        deudaCliente: debtDelta !== 0 ? { antes: previousDebt, despues: nextDebt, diferencia: debtDelta } : undefined,
        productosEditados: input.items ? true : undefined
      }
    }, tx);
    return updated;
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
    const pendingDebt = remitoPending(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
    if (pendingDebt !== 0) {
      await tx.cliente.update({
        where: { id: remito.clienteId },
        data: { saldoPendiente: { decrement: pendingDebt } }
      });
    }
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
    await audit({
      usuarioId: req.user!.id,
      modulo: "Ventas",
      accion: "CANCELAR",
      entidad: "Boleta",
      entidadId: remito.id,
      descripcion: `Canceló boleta #${remito.numero}`,
      cambios: { estado: { antes: remito.estado, despues: updated.estado }, deudaRestada: pendingDebt }
    }, tx);
  });
  res.status(204).send();
});

remittancesRouter.delete("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const id = String(req.params.id);
  const remito = await prisma.remito.findUnique({ where: { id }, include: { items: true } });
  if (!remito) fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");

  await prisma.$transaction(async (tx) => {
    if (remito.estado === "ACTIVO") {
      const pendingDebt = remitoPending(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
      if (pendingDebt !== 0) {
        await tx.cliente.update({
          where: { id: remito.clienteId },
          data: { saldoPendiente: { decrement: pendingDebt } }
        });
      }
      for (const item of remito.items) {
        await adjustProductStock(tx, {
          productoId: item.productoId,
          delta: item.cantidad,
          tipo: "CANCELACION_REMITO",
          usuarioId: req.user!.id,
          referenciaId: remito.id,
          referenciaTipo: "Remito",
          motivo: "Eliminación definitiva de boleta"
        });
      }
    }
    await tx.remitoItem.deleteMany({ where: { remitoId: remito.id } });
    await tx.remito.delete({ where: { id: remito.id } });
    await audit({
      usuarioId: req.user!.id,
      modulo: "Ventas",
      accion: "ELIMINAR",
      entidad: "Boleta",
      entidadId: remito.id,
      descripcion: `Eliminó definitivamente boleta #${remito.numero}`,
      cambios: { antes: remito }
    }, tx);
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
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  doc.pipe(res);
  const money = (value: unknown) => `$${Number(value).toFixed(2)}`;
  const deudaBoleta = remitoPending(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
  const saldoCuentaCorriente = Math.max(Number(remito.cliente.saldoPendiente), deudaBoleta);
  const discountAmount = Number(remito.subtotal) - Number(remito.total);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const right = left + pageWidth;

  doc.image(brandLogoPath, left, 22, { width: 118 });
  doc.fontSize(17).fillColor("#111111").text(`Boleta Nro. ${remito.numero}`, right - 190, 29, { width: 190, align: "right" });
  doc.fontSize(9).fillColor("#555555").text(`Fecha: ${remito.fecha.toISOString().slice(0, 10)}`, right - 190, 53, { width: 190, align: "right" });
  doc.text(`Estado: ${remito.estado === "ACTIVO" ? "Activo" : "Cancelado"}`, right - 190, 67, { width: 190, align: "right" });
  doc.moveTo(left, 91).lineTo(right, 91).strokeColor("#166534").lineWidth(1.2).stroke();

  doc.roundedRect(left, 106, pageWidth, 62, 4).strokeColor("#d9e2dd").lineWidth(0.8).stroke();
  doc.fontSize(9.5).fillColor("#111111").text("Cliente", left + 10, 117, { width: 80 });
  doc.fontSize(10.5).text(remito.cliente.nombre, left + 70, 116, { width: 210 });
  doc.fontSize(9.5).fillColor("#555555").text(`Dirección: ${remito.cliente.direccion ?? "-"}`, left + 70, 134, { width: 210 });
  doc.fillColor("#111111").text("Vendedor", left + 310, 117, { width: 70 });
  doc.fontSize(10.5).text(remito.vendedor?.nombre ?? "-", left + 382, 116, { width: 130 });
  doc.fontSize(9.5).fillColor("#555555").text(`Pago: ${remito.pagoEstado}${remito.metodoPago ? ` · ${remito.metodoPago}` : ""}`, left + 382, 134, { width: 140 });

  doc.roundedRect(left, 176, pageWidth, 28, 4).fillAndStroke("#f7fbf8", "#d9e2dd");
  doc.fillColor("#496054").fontSize(8).text("SALDO DE SU CTA CTE A LA FECHA", left + 10, 184, { width: 230 });
  doc.fillColor("#166534").fontSize(13).text(money(saldoCuentaCorriente), right - 170, 182, { width: 160, align: "right" });

  const startX = left;
  let y = 222;
  doc.rect(startX, y - 5, pageWidth, 18).fillAndStroke("#f5f1e8", "#d9e2dd");
  doc.fontSize(8.3).fillColor("#496054");
  doc.text("Código", startX + 6, y, { width: 64 });
  doc.text("Producto", startX + 78, y, { width: 220 });
  doc.text("Cant.", startX + 308, y, { width: 42, align: "right" });
  doc.text("Unit.", startX + 365, y, { width: 76, align: "right" });
  doc.text("Subtotal", startX + 456, y, { width: 76, align: "right" });
  y += 21;
  doc.fillColor("#111111").fontSize(8.5);
  for (const item of remito.items) {
    if (y > 326) {
      doc.fillColor("#777777").fontSize(8).text("Continúa en la siguiente boleta.", startX, y + 4, { width: pageWidth });
      break;
    }
    doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).strokeColor("#edf1ee").stroke();
    doc.text(item.codigoProducto, startX + 6, y, { width: 64 });
    doc.text(item.nombreProducto, startX + 78, y, { width: 220 });
    doc.text(String(item.cantidad), startX + 308, y, { width: 42, align: "right" });
    doc.text(money(item.precioUnitario), startX + 365, y, { width: 76, align: "right" });
    doc.text(money(item.subtotal), startX + 456, y, { width: 76, align: "right" });
    y += 18;
  }
  doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor("#d9e2dd").stroke();
  const totalsY = Math.min(y + 10, 334);
  doc.roundedRect(right - 218, totalsY, 218, 72, 4).fillAndStroke("#fffefa", "#d9e2dd");
  doc.fontSize(8.8).fillColor("#555555").text("Subtotal", right - 205, totalsY + 10, { width: 90 });
  doc.fillColor("#111111").text(money(remito.subtotal), right - 105, totalsY + 10, { width: 92, align: "right" });
  doc.fillColor("#555555").text(`Descuento ${Number(remito.descuentoPorcentaje)}%`, right - 205, totalsY + 27, { width: 100 });
  doc.fillColor("#111111").text(`-${money(discountAmount)}`, right - 105, totalsY + 27, { width: 92, align: "right" });
  doc.moveTo(right - 205, totalsY + 45).lineTo(right - 12, totalsY + 45).strokeColor("#d9e2dd").stroke();
  doc.fontSize(14).fillColor("#166534").text("Total", right - 205, totalsY + 51, { width: 70 });
  doc.text(money(remito.total), right - 120, totalsY + 51, { width: 108, align: "right" });
  doc.moveTo(left, 404).lineTo(right, 404).dash(3, { space: 4 }).strokeColor("#b9c7bf").stroke().undash();
  doc.fillColor("#777777").fontSize(7).text("Documento interno sin validez fiscal.", left, 382, { align: "center", width: pageWidth, lineBreak: false });
  doc.end();
});
