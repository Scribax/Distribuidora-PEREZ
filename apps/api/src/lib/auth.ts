import crypto from "node:crypto";
import argon2 from "argon2";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Rol, User } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

export type TokenUser = Pick<User, "id" | "email" | "nombre" | "rol">;

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function signAccessToken(user: TokenUser) {
  const options: SignOptions = { expiresIn: config.accessExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign({ userId: user.id, rol: user.rol, email: user.email, nombre: user.nombre }, config.jwtSecret, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.jwtSecret) as { userId: string; rol: Rol; email: string; nombre: string };
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueTokens(user: TokenUser) {
  const refreshToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt
    }
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    }
  };
}
