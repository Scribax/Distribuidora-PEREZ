import type { NextFunction, Request, Response } from "express";
import type { Rol } from "@prisma/client";
import { fail } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        rol: Rol;
        email: string;
        nombre: string;
      };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) fail(401, "TOKEN_INVALIDO", "Token inválido o expirado");

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.userId, rol: payload.rol, email: payload.email, nombre: payload.nombre };
    next();
  } catch {
    fail(401, "TOKEN_INVALIDO", "Token inválido o expirado");
  }
}

export function requireRoles(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) fail(401, "TOKEN_INVALIDO", "Token inválido o expirado");
    if (!roles.includes(req.user.rol)) fail(403, "SIN_PERMISO", "El rol del usuario no tiene permiso para esta operación");
    next();
  };
}
