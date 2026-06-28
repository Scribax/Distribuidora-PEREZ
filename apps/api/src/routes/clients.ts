import { Router } from "express";
import { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { clienteSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

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
  res.status(201).json(await prisma.cliente.create({ data: input }));
});

clientsRouter.patch("/:id", requireRoles(Rol.ADMINISTRADOR, Rol.EMPLEADO), async (req, res) => {
  const id = String(req.params.id);
  const input = clienteSchema.partial().parse(req.body);
  if ((input.activo === false || input.saldoPendiente !== undefined) && req.user!.rol !== Rol.ADMINISTRADOR) {
    fail(403, "SIN_PERMISO", "Solo el Administrador puede desactivar clientes o actualizar saldos");
  }
  res.json(await prisma.cliente.update({ where: { id }, data: input }));
});
