import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET no está configurado o es demasiado corto. Definí una variable de entorno JWT_SECRET de al menos 32 caracteres."
  );
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 7)
};
