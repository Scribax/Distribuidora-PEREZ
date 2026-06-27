import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@perez.local" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@perez.local",
      passwordHash: await hashPassword("Admin1234"),
      rol: "ADMINISTRADOR"
    }
  });

  console.log("Seed listo. Usuario admin inicial: admin@perez.local / Admin1234");
}

main().finally(() => prisma.$disconnect());
