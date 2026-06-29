import { Router } from "express";
import { Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { vendedorSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

vendorsRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const activo = String(req.query.activo ?? "");
  const where = activo === "true" ? { activo: true } : activo === "false" ? { activo: false } : {};
  const [items, total] = await Promise.all([
    prisma.vendedor.findMany({ where, skip, take, orderBy: { nombre: "asc" } }),
    prisma.vendedor.count({ where })
  ]);
  const stats = await prisma.remito.groupBy({
    by: ["vendedorId"],
    where: { estado: "ACTIVO", vendedorId: { in: items.map((item) => item.id) } },
    _sum: { total: true },
    _count: { _all: true }
  });
  const statsByVendor = new Map(stats.map((row) => [row.vendedorId, row]));
  res.json({
    items: items.map((vendor) => {
      const row = statsByVendor.get(vendor.id);
      const ventasTotal = Number(row?._sum.total ?? 0);
      const comisionTotal = ventasTotal * Number(vendor.porcentajeComision) / 100;
      return { ...vendor, ventasTotal, boletasTotal: row?._count._all ?? 0, comisionTotal };
    }),
    total,
    page,
    pageSize
  });
});

vendorsRouter.post("/", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = vendedorSchema.parse(req.body);
  const vendedor = await prisma.vendedor.create({ data: input });
  res.status(201).json(vendedor);
});

vendorsRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = vendedorSchema.partial().parse(req.body);
  const vendedor = await prisma.vendedor.update({ where: { id: String(req.params.id) }, data: input });
  res.json(vendedor);
});
