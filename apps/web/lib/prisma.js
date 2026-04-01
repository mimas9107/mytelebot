import "@/lib/server-env";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { workspaceRoot } from "@/lib/server-env";

const globalForPrisma = globalThis;
const sqliteFilePath = process.env.SQLITE_FILE_PATH || path.join(".", "data", "mytelebot.sqlite");
const rawConnectionString =
  process.env.DATABASE_URL || `file:${sqliteFilePath}`;
const resolvedConnectionString = rawConnectionString.startsWith("file:")
  ? `file:${path.resolve(workspaceRoot, sqliteFilePath)}`
  : rawConnectionString;
const adapter = new PrismaBetterSqlite3({ url: resolvedConnectionString });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
