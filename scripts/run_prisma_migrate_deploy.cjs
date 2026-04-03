#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const Database = require("better-sqlite3");

function runPrismaMigrateDeploy() {
  return spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env
  });
}

function resolveSqlitePath() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (databaseUrl.startsWith("file:")) {
    const filePath = databaseUrl.slice(5);
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  }

  if (process.env.SQLITE_FILE_PATH) {
    return path.isAbsolute(process.env.SQLITE_FILE_PATH)
      ? process.env.SQLITE_FILE_PATH
      : path.resolve(process.cwd(), process.env.SQLITE_FILE_PATH);
  }

  return path.resolve(process.cwd(), "data", "mytelebot.sqlite");
}

function listMigrationDirectories() {
  const migrationsRoot = path.resolve(process.cwd(), "prisma", "migrations");

  if (!fs.existsSync(migrationsRoot)) {
    return [];
  }

  return fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function inspectSqliteDatabase(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      hasTables: false,
      hasMigrationsTable: false
    };
  }

  const database = new Database(filePath, { fileMustExist: true, readonly: true });

  try {
    const rows = database
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'`
      )
      .all();

    const tableNames = rows.map((row) => row.name);

    return {
      exists: true,
      hasTables: tableNames.length > 0,
      hasMigrationsTable: tableNames.includes("_prisma_migrations")
    };
  } finally {
    database.close();
  }
}

function baselineExistingSqliteDatabase() {
  const sqliteFilePath = resolveSqlitePath();
  const databaseState = inspectSqliteDatabase(sqliteFilePath);

  if (!databaseState.exists || !databaseState.hasTables || databaseState.hasMigrationsTable) {
    return false;
  }

  const migrations = listMigrationDirectories();

  if (migrations.length === 0) {
    return false;
  }

  console.log(
    `[prisma-baseline] existing SQLite database detected without _prisma_migrations at ${sqliteFilePath}`
  );
  console.log("[prisma-baseline] writing baseline rows into _prisma_migrations");

  const database = new Database(sqliteFilePath, { fileMustExist: true });

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);

    const insertMigration = database.prepare(`
      INSERT INTO "_prisma_migrations" (
        "id",
        "checksum",
        "finished_at",
        "migration_name",
        "logs",
        "rolled_back_at",
        "started_at",
        "applied_steps_count"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAll = database.transaction((migrationNames) => {
      for (const migrationName of migrationNames) {
        const migrationFilePath = path.resolve(
          process.cwd(),
          "prisma",
          "migrations",
          migrationName,
          "migration.sql"
        );
        const sql = fs.readFileSync(migrationFilePath, "utf8");
        const timestamp = new Date().toISOString();
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");

        insertMigration.run(
          crypto.randomUUID(),
          checksum,
          timestamp,
          migrationName,
          "",
          null,
          timestamp,
          1
        );
      }
    });

    insertAll(migrations);
  } finally {
    database.close();
  }

  return true;
}

function main() {
  const firstAttempt = runPrismaMigrateDeploy();

  if (firstAttempt.status === 0) {
    process.exit(0);
  }

  const baselineApplied = baselineExistingSqliteDatabase();

  if (!baselineApplied) {
    process.exit(firstAttempt.status || 1);
  }

  const secondAttempt = runPrismaMigrateDeploy();
  process.exit(secondAttempt.status || 1);
}

main();
