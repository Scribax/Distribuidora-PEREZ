import { Router } from "express";
import { Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { hashPassword } from "../lib/auth.js";
import { userCreateSchema, userUpdateSchema } from "../lib/schemas.js";
import { pageArgs } from "../lib/validation.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRoles(Rol.ADMINISTRADOR));

usersRouter.get("/", async (req, res) => {
  const { skip, take, page, pageSize } = pageArgs(req.query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({ skip, take, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true } }),
    prisma.user.count()
  ]);
  res.json({ items, total, page, pageSize });
});

usersRouter.post("/", async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  try {
    const { password, ...userInput } = input;
    const user = await prisma.user.create({
      data: { ...userInput, passwordHash: await hashPassword(password) },
      select: { id: true, nombre: true, email: true, rol: true, activo: true }
    });
    res.status(201).json(user);
  } catch {
    fail(422, "EMAIL_DUPLICADO", "El email ya está registrado");
  }
});

usersRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const input = userUpdateSchema.parse(req.body);
  if (input.activo === false) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.rol === Rol.ADMINISTRADOR) {
      const admins = await prisma.user.count({ where: { rol: Rol.ADMINISTRADOR, activo: true, NOT: { id } } });
      if (admins === 0) fail(422, "ULTIMO_ADMIN", "No se puede desactivar al último administrador activo");
    }
  }
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  const user = await prisma.user.update({
    where: { id },
    data: { nombre: input.nombre, email: input.email, rol: input.rol, activo: input.activo, passwordHash },
    select: { id: true, nombre: true, email: true, rol: true, activo: true }
  });
  if (input.activo === false) await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
  res.json(user);
});
