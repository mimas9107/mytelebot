import "@/lib/server-env";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
const sqliteUrl =
  process.env.DATABASE_URL ||
  `file:${process.env.SQLITE_FILE_PATH || "./data/mytelebot.sqlite"}`;

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"]
  });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getPrismaClient();
      const value = Reflect.get(client, property);

      return typeof value === "function" ? value.bind(client) : value;
    }
  }
);
