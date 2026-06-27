import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";
import { hashToken, issueTokens, verifyPassword } from "../lib/auth.js";
import { loginSchema } from "../lib/schemas.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) fail(401, "CREDENCIALES_INVALIDAS", "Credenciales inválidas");
  if (!user.activo) fail(401, "CUENTA_DESACTIVADA", "Cuenta desactivada. Contacte al administrador");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) fail(401, "CREDENCIALES_INVALIDAS", "Credenciales inválidas");
  res.json(await issueTokens(user));
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = String(req.body?.refreshToken ?? "");
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) fail(401, "TOKEN_REVOCADO", "Refresh token inválido o revocado");
  if (!stored.user.activo) fail(401, "CUENTA_DESACTIVADA", "Cuenta desactivada. Contacte al administrador");
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  res.json(await issueTokens(stored.user));
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const refreshToken = String(req.body?.refreshToken ?? "");
  if (refreshToken) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revoked: true } });
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
