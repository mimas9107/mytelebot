import "@/lib/server-env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
