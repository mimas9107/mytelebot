#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
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
  console.log("[prisma-baseline] marking committed migrations as already applied");

  for (const migrationName of migrations) {
    const result = spawnSync("npx", ["prisma", "migrate", "resolve", "--applied", migrationName], {
      stdio: "inherit",
      env: process.env
    });

    if (result.status !== 0) {
      return false;
    }
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
