import { z } from "zod";
import { cleanText, moneySchema, nonNegativeIntSchema, positiveIntSchema } from "./validation.js";

const text = (max: number) => z.string().transform(cleanText).pipe(z.string().min(1).max(max));
const optionalText = (max: number) => z.string().transform(cleanText).pipe(z.string().max(max)).optional().nullable();

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1)
});

export const userCreateSchema = z.object({
  nombre: text(100),
  email: z.string().email().max(150).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8),
  rol: z.enum(["ADMINISTRADOR", "EMPLEADO", "CONSULTA"])
});

export const userUpdateSchema = z.object({
  nombre: text(100).optional(),
  email: z.string().email().max(150).transform((v) => v.toLowerCase().trim()).optional(),
  password: z.string().min(8).optional(),
  rol: z.enum(["ADMINISTRADOR", "EMPLEADO", "CONSULTA"]).optional(),
  activo: z.boolean().optional()
});

export const categoriaSchema = z.object({
  nombre: text(80),
  activo: z.boolean().optional()
});

export const productoSchema = z.object({
  codigoInterno: text(50).refine((v) => !/\s/.test(v), "El código interno no puede contener espacios").optional(),
  nombre: text(200),
  categoriaId: z.string().uuid(),
  precioMayorista: moneySchema,
  precioMinorista: moneySchema,
  costo: moneySchema,
  stockActual: nonNegativeIntSchema,
  stockMinimo: nonNegativeIntSchema,
  activo: z.boolean().optional()
});

export const productoUpdateSchema = productoSchema.partial();

export const clienteSchema = z.object({
  nombre: text(150),
  empresa: optionalText(150),
  direccion: optionalText(300),
  telefono: optionalText(30),
  email: z.string().email().max(150).optional().nullable(),
  observaciones: z.string().transform(cleanText).optional().nullable(),
  saldoPendiente: moneySchema.optional(),
  activo: z.boolean().optional()
});

export const compraSchema = z.object({
  proveedorId: z.string().uuid().optional().nullable(),
  proveedorNombre: text(150),
  fecha: z.coerce.date(),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: positiveIntSchema,
    costoUnitario: moneySchema,
    actualizarCosto: z.boolean().default(true)
  })).min(1)
});

export const remitoSchema = z.object({
  clienteId: z.string().uuid(),
  vendedorId: z.string().uuid().optional().nullable(),
  listaPrecios: z.enum(["MAYORISTA", "MINORISTA"]),
  pagoEstado: z.enum(["PENDIENTE", "PARCIAL", "PAGADA"]).default("PENDIENTE"),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]).optional().nullable(),
  montoPagado: moneySchema.default(0),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  fecha: z.coerce.date().default(() => new Date()),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: positiveIntSchema
  })).min(1)
});

export const remitoUpdateSchema = z.object({
  pagoEstado: z.enum(["PENDIENTE", "PARCIAL", "PAGADA"]).optional(),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]).optional().nullable(),
  montoPagado: moneySchema.optional(),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).optional(),
  vendedorId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: positiveIntSchema
  })).min(1).optional()
});

export const ajusteStockSchema = z.object({
  productoId: z.string().uuid(),
  cantidadNueva: nonNegativeIntSchema,
  motivo: text(300).refine((v) => v.length >= 10, "El motivo debe tener al menos 10 caracteres")
});

export const vendedorSchema = z.object({
  nombre: text(120),
  porcentajeComision: moneySchema.max(100).default(0),
  activo: z.boolean().optional()
});

export const proveedorSchema = z.object({
  nombre: text(150),
  contacto: optionalText(120),
  telefono: optionalText(30),
  email: z.string().email().max(150).optional().nullable().or(z.literal("").transform(() => null)),
  cuit: optionalText(30),
  direccion: optionalText(300),
  observaciones: z.string().transform(cleanText).optional().nullable(),
  activo: z.boolean().optional()
});

export const gastoSchema = z.object({
  fecha: z.coerce.date().default(() => new Date()),
  categoria: z.enum(["COMBUSTIBLE", "FLETE", "ALQUILER", "SUELDOS", "SERVICIOS", "MANTENIMIENTO", "INSUMOS", "IMPUESTOS", "OTRO"]).default("OTRO"),
  descripcion: text(250),
  monto: moneySchema,
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]).optional().nullable(),
  comprobante: optionalText(120),
  observaciones: z.string().transform(cleanText).optional().nullable()
});

export const cuentaComercialMovimientoSchema = z.object({
  vendedorId: z.string().uuid(),
  tipo: z.enum(["APORTE", "RETIRO", "AJUSTE"]),
  fecha: z.coerce.date().default(() => new Date()),
  monto: moneySchema,
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "OTRO"]).optional().nullable(),
  descripcion: text(250),
  comprobante: optionalText(120),
  observaciones: z.string().transform(cleanText).optional().nullable()
});

export const aumentoPreciosSchema = z.object({
  categoriaId: z.string().uuid().optional().nullable(),
  porcentaje: z.coerce.number().min(-99).max(1000),
  aplicarMayorista: z.boolean().default(true),
  aplicarMinorista: z.boolean().default(true)
}).refine((value) => value.aplicarMayorista || value.aplicarMinorista, "Debe seleccionar al menos una lista de precios");
