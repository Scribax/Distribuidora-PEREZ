import { z } from "zod";

export const idSchema = z.string().uuid();
// Monto con hasta 2 decimales. Evitamos `multipleOf(0.01)` porque la representación
// en punto flotante hace que rechace valores válidos (p. ej. ciertos x.99).
export const moneySchema = z.coerce
  .number()
  .min(0)
  .refine((value) => Number.isFinite(value) && Math.round(value * 100) / 100 === value, {
    message: "El monto admite como máximo 2 decimales"
  });
export const positiveIntSchema = z.coerce.number().int().positive();
export const nonNegativeIntSchema = z.coerce.number().int().min(0);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export function cleanText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

export function pageArgs(query: unknown) {
  const { page, pageSize } = paginationSchema.parse(query);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
