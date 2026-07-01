import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { proveedorSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { audit, diffFields } from "../lib/audit.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

suppliersRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const activo = String(req.query.activo ?? "");
  const q = String(req.query.q ?? "").trim();
  const where: Prisma.ProveedorWhereInput = {
    activo: activo === "true" ? true : activo === "false" ? false : undefined,
    OR: q ? [
      { nombre: { contains: q, mode: "insensitive" } },
      { contacto: { contains: q, mode: "insensitive" } },
      { cuit: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q, mode: "insensitive" } }
    ] : undefined
  };
  const [items, total] = await Promise.all([
    prisma.proveedor.findMany({ where, skip, take, orderBy: { nombre: "asc" } }),
    prisma.proveedor.count({ where })
  ]);
  res.json({ items, total, page, pageSize });
});

suppliersRouter.post("/", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const input = proveedorSchema.parse(req.body);
  const proveedor = await prisma.proveedor.create({ data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "CREAR",
    entidad: "Proveedor",
    entidadId: proveedor.id,
    descripcion: `Creó el proveedor ${proveedor.nombre}`,
    cambios: { despues: proveedor }
  });
  res.status(201).json(proveedor);
});

suppliersRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR), async (req, res) => {
  const input = proveedorSchema.partial().parse(req.body);
  const before = await prisma.proveedor.findUnique({ where: { id: String(req.params.id) } });
  if (!before) fail(404, "PROVEEDOR_NO_ENCONTRADO", "Proveedor no encontrado");
  const proveedor = await prisma.proveedor.update({ where: { id: String(req.params.id) }, data: input });
  await audit({
    usuarioId: req.user!.id,
    modulo: "Comerciales",
    accion: "EDITAR",
    entidad: "Proveedor",
    entidadId: proveedor.id,
    descripcion: `Editó el proveedor ${proveedor.nombre}`,
    cambios: diffFields(before, proveedor, ["nombre", "contacto", "telefono", "email", "cuit", "direccion", "observaciones", "activo"])
  });
  res.json(proveedor);
});
