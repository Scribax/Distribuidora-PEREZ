import { z } from "zod";

export const idSchema = z.string().uuid();
export const moneySchema = z.coerce.number().min(0).multipleOf(0.01);
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
