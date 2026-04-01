import "@/lib/server-env";
import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { workspaceRoot } from "@/lib/server-env";

const globalForPrisma = globalThis;
const sqliteFilePath = process.env.SQLITE_FILE_PATH || path.join(".", "data", "mytelebot.sqlite");
const rawConnectionString =
  process.env.DATABASE_URL || `file:${sqliteFilePath}`;
const sqliteTargetPath = rawConnectionString.startsWith("file:")
  ? rawConnectionString.slice("file:".length) || sqliteFilePath
  : null;
const resolvedSqlitePath = sqliteTargetPath
  ? path.isAbsolute(sqliteTargetPath)
    ? sqliteTargetPath
    : path.resolve(workspaceRoot, sqliteTargetPath)
  : null;

const resolvedConnectionString = resolvedSqlitePath
  ? `file:${resolvedSqlitePath}`
  : rawConnectionString;

function createPrismaClient() {
  if (resolvedSqlitePath) {
    fs.mkdirSync(path.dirname(resolvedSqlitePath), { recursive: true });
  }

  const adapter = new PrismaBetterSqlite3({ url: resolvedConnectionString });

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
