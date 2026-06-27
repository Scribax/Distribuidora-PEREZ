import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function fail(status: number, code: string, message: string, details?: unknown): never {
  throw new AppError(status, code, message, details);
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: true,
      code: error.code,
      message: error.message,
      details: error.details ?? []
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: true,
      code: "VALIDACION_INVALIDA",
      message: "Hay campos inválidos en la solicitud",
      details: error.issues
    });
  }

  console.error(error);
  return res.status(500).json({
    error: true,
    code: "ERROR_INTERNO",
    message: "Ocurrió un error interno del servidor",
    details: []
  });
}
