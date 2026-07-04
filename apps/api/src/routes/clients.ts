import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { clienteSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit, diffFields } from "../lib/audit.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
const deletedClientsBackupDir = path.resolve(process.cwd(), "backups/clientes-eliminados");
const amountPattern = String.raw`\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}`;
const bareAmountPattern = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;

function backupFileName(clientName: string, clientId: string) {
  const safeName = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "cliente";
  return `${new Date().toISOString().replace(/[:.]/g, "-")}_${safeName}_${clientId}.json`;
}

function remitoDebt(total: number, montoPagado: number, pagoEstado?: string) {
  if (pagoEstado === "PAGADA") return 0;
  return Number(Math.max(total - montoPagado, 0).toFixed(2));
}

function parseArgMoney(value: string) {
  const normalized = value.replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function parseArgDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

async function extractPdfTextFromBase64(pdfBase64: string) {
  const clean = pdfBase64.replace(/^data:application\/pdf;base64,/i, "").trim();
  const buffer = Buffer.from(clean, "base64");
  if (!buffer.length || buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    fail(422, "PDF_INVALIDO", "El archivo no parece ser un PDF válido");
  }
  const parsed = await pdfParse(buffer);
  return parsed.text ?? "";
}

function parseHistoricalClientReport(text: string) {
  const source = text.replace(/\r/g, "\n");
  const compact = source.replace(/\s+/g, " ").trim();
  const titleMatch = compact.match(/Informe del cliente para\s+(.+?)(?:\s+-\s+|\s{2,}| Número | Fecha | Subtotal |$)/i);
  const tableIndex = source.search(/Número|Numero/i);
  const beforeTable = tableIndex >= 0 ? source.slice(0, tableIndex) : source;
  const uppercaseNames = beforeTable.split("\n").map((line) => line.trim()).filter((line) => /^[A-ZÁÉÍÓÚÑ0-9 .'-]{3,}$/.test(line) && !/INFORME|DISTRIBUIDORA/.test(line));
  const nombre = (titleMatch?.[1] ?? uppercaseNames.at(-1) ?? "").replace(/\s+-\s*$/, "").trim();
  if (!nombre) fail(422, "CLIENTE_NO_DETECTADO", "No pude detectar el nombre del cliente en el informe");

  const spacedRowRe = new RegExp(String.raw`^\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(${amountPattern})\s+(${amountPattern})\s+(${amountPattern})\s+(${amountPattern})(?:\s*ARS)?\s*$`);
  const compactRowRe = new RegExp(String.raw`^\s*(\d+?)(\d{2}\/\d{2}\/\d{4})(${bareAmountPattern})(${bareAmountPattern})(${bareAmountPattern})\$?\s*(${bareAmountPattern})(?:\s*ARS)?\s*$`);
  const facturas = source.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).map((line) => {
    const match = line.match(spacedRowRe) ?? line.match(compactRowRe);
    if (!match) return null;
    return {
      numero: Number(match[1]),
      fecha: parseArgDate(match[2]),
      subtotal: parseArgMoney(match[3]),
      impuesto: parseArgMoney(match[4]),
      pagado: parseArgMoney(match[5]),
      total: parseArgMoney(match[6])
    };
  }).filter(Boolean) as { numero: number; fecha: Date; subtotal: number; impuesto: number; pagado: number; total: number }[];
  if (!facturas.length) fail(422, "FACTURAS_NO_DETECTADAS", "No pude detectar facturas en el informe. Probá copiar el texto completo del PDF");

  const totalMatch = compact.match(new RegExp(String.raw`Total\s*(${amountPattern})\s*ARS`, "i"));
  const paidMatch = compact.match(new RegExp(String.raw`Pagado\s*(${amountPattern})\s*ARS`, "i"));
  const balanceMatch = compact.match(new RegExp(String.raw`Saldo debido\s*(${amountPattern})\s*ARS`, "i"));
  const total = totalMatch ? parseArgMoney(totalMatch[1]) : facturas.reduce((sum, item) => sum + item.total, 0);
  const pagado = paidMatch ? parseArgMoney(paidMatch[1]) : facturas.reduce((sum, item) => sum + item.pagado, 0);
  const saldo = balanceMatch ? parseArgMoney(balanceMatch[1]) : Number(Math.max(total - pagado, 0).toFixed(2));
  return { nombre, facturas, total, pagado, saldo };
}

clientsRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const q = String(req.query.q ?? "").trim();
  const where: Prisma.ClienteWhereInput = q ? {
    OR: [
      { nombre: { contains: q, mode: "insensitive" } },
      { empresa: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ]
  } : {};
  const [items, total] = await Promise.all([
    prisma.cliente.findMany({ where, skip, take, orderBy: { nombre: "asc" } }),
    prisma.cliente.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

function money(value: number | string | Prisma.Decimal | unknown) {
  const n = Number(value);
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number.isFinite(n) ? n : 0);
}

function normalizePhoneForWhatsApp(telefono?: string | null, defaultCountryCode = "54"): string | null {
  if (!telefono) return null;
  const trimmed = telefono.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return digits;
  const countryCode = defaultCountryCode.replace(/\D/g, "");
  if (!countryCode) return digits;
  if (digits.startsWith(countryCode)) return digits;
  return `${countryCode}${digits}`;
}

function buildCobroMessage(row: { cliente_nombre: string; saldo: number }): string {
  const saldoFmt = money(row.saldo);
  return [
    `¡Hola ${row.cliente_nombre}! 👋🏻`,
    `Le recuerdo el saldo debido de ${saldoFmt} ‼️`,
    `Para transferir, el Alias: perezmartin.pagos a nombre de Eduardo Gregorio Perez.`,
    `Aviseme si quiere que pase a cobrar en efectivo y si hace falta que lleve algún pedido.`,
    `Muchas gracias 😃`,
    `Distribuidora Perez Martin 🧢`
  ].join("\n");
}

clientsRouter.get("/cobros-pendientes", async (req, res) => {
  try {
    const dias = Number(req.query.dias ?? 5);
    const dateThreshold = new Date();
    dateThreshold.setHours(23, 59, 59, 999);
    dateThreshold.setDate(dateThreshold.getDate() - dias);

    const remitos = await prisma.remito.findMany({
      where: {
        estado: "ACTIVO",
        pagoEstado: { in: ["PENDIENTE", "PARCIAL"] },
        fecha: { lte: dateThreshold },
        cliente: { activo: true }
      },
      include: {
        cliente: true
      },
      orderBy: [
        { fecha: "asc" }
      ]
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        modulo: "Clientes",
        accion: "ENVIAR_RECORDATORIO",
        entidad: "Remito",
        entidadId: { in: remitos.map((r) => r.id) }
      },
      orderBy: { createdAt: "desc" }
    });

    const lastNotifMap = new Map<string, Date>();
    for (const log of auditLogs) {
      if (log.entidadId && !lastNotifMap.has(log.entidadId)) {
        lastNotifMap.set(log.entidadId, log.createdAt);
      }
    }

    const cobros = remitos.map((remito) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fechaRemito = new Date(remito.fecha);
      fechaRemito.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - fechaRemito.getTime();
      const dias_vencida = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const saldo = Number(remito.total) - Number(remito.montoPagado);
      const telefonoWhatsapp = normalizePhoneForWhatsApp(remito.cliente.telefono);

      const mensaje = buildCobroMessage({
        cliente_nombre: remito.cliente.nombre,
        saldo
      });

      return {
        remito_id: remito.id,
        numero: remito.numero,
        cliente_id: remito.clienteId,
        cliente_nombre: remito.cliente.nombre,
        telefono: remito.cliente.telefono || "",
        telefono_whatsapp: telefonoWhatsapp || "",
        fecha: remito.fecha,
        total: Number(remito.total),
        pagado: Number(remito.montoPagado),
        saldo,
        estado: remito.pagoEstado,
        dias_vencida,
        mensaje,
        whatsapp_url: telefonoWhatsapp ? `https://wa.me/${telefonoWhatsapp}?text=${encodeURIComponent(mensaje)}` : "",
        ultima_notificacion_at: lastNotifMap.get(remito.id) || null
      };
    });

    const sinTelefono = cobros.filter((c) => !c.telefono_whatsapp).length;

    res.json({
      dias_vencido: dias,
      total: cobros.length,
      sin_telefono: sinTelefono,
      cobros
    });
  } catch (error) {
    console.error("Error en GET /clientes/cobros-pendientes:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

clientsRouter.post("/cobros-pendientes/:remitoId/registrar", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  try {
    const remitoId = String(req.params.remitoId);
    const remito = await prisma.remito.findUnique({
      where: { id: remitoId },
      include: { cliente: true }
    });
    if (!remito) {
      fail(404, "REMITO_NO_ENCONTRADO", "Remito no encontrado");
    }

    const saldo = Number(remito.total) - Number(remito.montoPagado);
    await audit({
      usuarioId: req.user!.id,
      modulo: "Clientes",
      accion: "ENVIAR_RECORDATORIO",
      entidad: "Remito",
      entidadId: remito.id,
      descripcion: `Envió recordatorio de cobro por WhatsApp a ${remito.cliente.nombre} por boleta #${remito.numero} (saldo: ${money(saldo)})`,
      cambios: {
        remitoId: remito.id,
        numero: remito.numero,
        cliente: remito.cliente.nombre,
        telefono: remito.cliente.telefono,
        saldo
      }
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Error en POST /clientes/cobros-pendientes/:remitoId/registrar:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

clientsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      remitos: { orderBy: { fecha: "desc" }, take: 50, include: { items: true, vendedor: true } },
      historialImportado: { orderBy: { createdAt: "desc" }, include: { facturas: { orderBy: { fecha: "desc" } } } }
    }
  });
  if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  res.json(cliente);
});

clientsRouter.post("/importar-historial", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const pdfBase64 = typeof req.body?.pdfBase64 === "string" ? req.body.pdfBase64 : "";
  const texto = pdfBase64 ? await extractPdfTextFromBase64(pdfBase64) : String(req.body?.texto ?? "");
  const actualizarSaldo = req.body?.actualizarSaldo !== false;
  if (texto.trim().length < 50) fail(422, "TEXTO_INVALIDO", "Pegá el texto completo del informe del cliente");
  const parsed = parseHistoricalClientReport(texto);
  const result = await prisma.$transaction(async (tx) => {
    let cliente = await tx.cliente.findFirst({ where: { nombre: { equals: parsed.nombre, mode: "insensitive" } } });
    if (!cliente) {
      cliente = await tx.cliente.create({ data: { nombre: parsed.nombre, saldoPendiente: actualizarSaldo ? parsed.saldo : 0 } });
    } else if (actualizarSaldo) {
      cliente = await tx.cliente.update({ where: { id: cliente.id }, data: { saldoPendiente: parsed.saldo } });
    }
    const importacion = await tx.clienteHistorialImportacion.create({
      data: {
        clienteId: cliente.id,
        nombreOriginal: parsed.nombre,
        total: parsed.total,
        pagado: parsed.pagado,
        saldo: parsed.saldo,
        usuarioId: req.user!.id,
        facturas: { create: parsed.facturas }
      },
      include: { facturas: { orderBy: { fecha: "desc" } } }
    });
    await audit({
      usuarioId: req.user!.id,
      modulo: "Clientes",
      accion: "CREAR",
      entidad: "Historial anterior",
      entidadId: importacion.id,
      descripcion: `Importó historial anterior de ${cliente.nombre}`,
      cambios: { facturas: parsed.facturas.length, total: parsed.total, pagado: parsed.pagado, saldo: parsed.saldo, saldoActualizado: actualizarSaldo }
    }, tx);
    return { cliente, importacion };
  });
  res.status(201).json(result);
});

clientsRouter.post("/", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = clienteSchema.parse(req.body);
  const cliente = await prisma.cliente.create({ data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Clientes",
    accion: "CREAR",
    entidad: "Cliente",
    entidadId: cliente.id,
    descripcion: `Creó el cliente ${cliente.nombre}`,
    cambios: { despues: cliente }
  });
  res.status(201).json(cliente);
});

clientsRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const input = clienteSchema.partial().parse(req.body);
  if ((input.activo === false || input.saldoPendiente !== undefined) && req.user!.rol !== Rol.ADMINISTRADOR) {
    fail(403, "SIN_PERMISO", "Solo el Administrador puede desactivar clientes o actualizar saldos");
  }
  const before = await prisma.cliente.findUnique({ where: { id } });
  if (!before) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  const cliente = await prisma.cliente.update({ where: { id }, data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Clientes",
    accion: "EDITAR",
    entidad: "Cliente",
    entidadId: cliente.id,
    descripcion: `Editó el cliente ${cliente.nombre}`,
    cambios: diffFields(before, cliente, ["nombre", "empresa", "direccion", "telefono", "email", "observaciones", "saldoPendiente", "activo"])
  });
  res.json(cliente);
});

clientsRouter.delete("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const id = String(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      remitos: {
        include: {
          items: true,
          vendedor: true,
          usuario: { select: { id: true, nombre: true, email: true, rol: true } }
        },
        orderBy: { fecha: "desc" }
      },
      historialImportado: { include: { facturas: true } }
    }
  });
  if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  await fs.mkdir(deletedClientsBackupDir, { recursive: true });
  const backupPath = path.join(deletedClientsBackupDir, backupFileName(cliente.nombre, cliente.id));
  await fs.writeFile(backupPath, JSON.stringify({
    deletedAt: new Date().toISOString(),
    deletedBy: req.user,
    warning: "Backup generado automáticamente antes de eliminar definitivamente el cliente.",
    cliente
  }, null, 2), "utf8");

  await prisma.$transaction(async (tx) => {
    for (const remito of cliente.remitos) {
      if (remito.estado === "ACTIVO") {
        const pendingDebt = remitoDebt(Number(remito.total), Number(remito.montoPagado), remito.pagoEstado);
        if (pendingDebt !== 0) {
          await tx.cliente.update({ where: { id: cliente.id }, data: { saldoPendiente: { decrement: pendingDebt } } });
        }
        for (const item of remito.items) {
          await tx.producto.update({ where: { id: item.productoId }, data: { stockActual: { increment: item.cantidad } } });
          const producto = await tx.producto.findUnique({ where: { id: item.productoId }, select: { stockActual: true } });
          await tx.movimientoStock.create({
            data: {
              productoId: item.productoId,
              tipo: "CANCELACION_REMITO",
              cantidad: item.cantidad,
              stockResultante: producto?.stockActual ?? item.cantidad,
              usuarioId: req.user!.id,
              referenciaId: remito.id,
              referenciaTipo: "Remito",
              motivo: `Restauración por eliminación definitiva del cliente ${cliente.nombre}`
            }
          });
        }
      }
      await tx.remitoItem.deleteMany({ where: { remitoId: remito.id } });
    }
    await tx.remito.deleteMany({ where: { clienteId: cliente.id } });
    await tx.cliente.delete({ where: { id: cliente.id } });
    await audit({
      usuarioId: req.user!.id,
      modulo: "Clientes",
      accion: "ELIMINAR",
      entidad: "Cliente",
      entidadId: cliente.id,
      descripcion: `Eliminó definitivamente el cliente ${cliente.nombre}`,
      cambios: { backupPath, boletasEliminadas: cliente.remitos.length, antes: cliente }
    }, tx);
  });
  res.status(204).send();
});
