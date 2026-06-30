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

clientsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { remitos: { orderBy: { fecha: "desc" }, take: 50, include: { items: true, vendedor: true } } }
  });
  if (!cliente) fail(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
  res.json(cliente);
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
