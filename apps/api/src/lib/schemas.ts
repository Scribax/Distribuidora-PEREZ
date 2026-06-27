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
  codigoInterno: text(50).refine((v) => !/\s/.test(v), "El código interno no puede contener espacios"),
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
  listaPrecios: z.enum(["MAYORISTA", "MINORISTA"]),
  fecha: z.coerce.date().default(() => new Date()),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: positiveIntSchema
  })).min(1)
});

export const remitoUpdateSchema = z.object({
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: positiveIntSchema
  })).min(1)
});

export const ajusteStockSchema = z.object({
  productoId: z.string().uuid(),
  cantidadNueva: nonNegativeIntSchema,
  motivo: text(300).refine((v) => v.length >= 10, "El motivo debe tener al menos 10 caracteres")
});
