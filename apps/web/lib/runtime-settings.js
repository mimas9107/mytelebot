import path from "node:path";
import Database from "better-sqlite3";

const SETTINGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_runtime_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

const cache = {
  verboseServerLogs: null,
  loadedAt: 0
};

function resolveSqliteFilePath() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (databaseUrl.startsWith("file:")) {
    const filePath = databaseUrl.slice(5);

    if (filePath.startsWith("/")) {
      return filePath;
    }

    return path.resolve(process.cwd(), filePath);
  }

  if (process.env.SQLITE_FILE_PATH) {
    const configured = process.env.SQLITE_FILE_PATH;
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  return path.resolve(process.cwd(), "data", "mytelebot.sqlite");
}

function openDatabase({ readonly = false, fileMustExist = false } = {}) {
  return new Database(resolveSqliteFilePath(), {
    readonly,
    fileMustExist
  });
}

function ensureSettingsTable(database) {
  database.exec(SETTINGS_TABLE_SQL);
}

function parseBooleanSetting(value, fallback = true) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getVerboseServerLogsEnabled(options = {}) {
  const { ttlMs = 3000, fallback = true } = options;

  if (Date.now() - cache.loadedAt < ttlMs && cache.verboseServerLogs !== null) {
    return cache.verboseServerLogs;
  }

  let database;

  try {
    database = openDatabase({ readonly: false, fileMustExist: false });
    ensureSettingsTable(database);

    const row = database
      .prepare(
        `SELECT setting_value
         FROM app_runtime_settings
         WHERE setting_key = ?`
      )
      .get("verbose_server_logs");

    const enabled = parseBooleanSetting(row?.setting_value, fallback);
    cache.verboseServerLogs = enabled;
    cache.loadedAt = Date.now();
    return enabled;
  } catch {
    return fallback;
  } finally {
    database?.close();
  }
}

export function setVerboseServerLogsEnabled(enabled) {
  const normalized = enabled ? "true" : "false";
  const updatedAt = new Date().toISOString();
  const database = openDatabase({ readonly: false, fileMustExist: false });

  try {
    ensureSettingsTable(database);
    database
      .prepare(
        `INSERT INTO app_runtime_settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(setting_key)
         DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at`
      )
      .run("verbose_server_logs", normalized, updatedAt);
  } finally {
    database.close();
  }

  cache.verboseServerLogs = enabled;
  cache.loadedAt = Date.now();

  return {
    enabled,
    updatedAt
  };
}

export function listRuntimeSettings() {
  const enabled = getVerboseServerLogsEnabled({ ttlMs: 0, fallback: true });

  return {
    verboseServerLogs: enabled
  };
}
