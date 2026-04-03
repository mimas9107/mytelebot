import "@/lib/server-env";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { prisma } from "@/lib/prisma";
import { workspaceRoot } from "@/lib/server-env";
import {
  listRuntimeSettings,
  setVerboseServerLogsEnabled
} from "@/lib/runtime-settings";

function getSqliteFilePath() {
  const configured = process.env.SQLITE_FILE_PATH || path.join(".", "data", "mytelebot.sqlite");
  return path.resolve(workspaceRoot, configured);
}

function getBackupDirPath() {
  const configured = process.env.SQLITE_BACKUP_DIR || path.join(".", "data", "backups");
  return path.resolve(workspaceRoot, configured);
}

function formatBackupFilename() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");

  return `mytelebot-${stamp}.sqlite`;
}

function resolveBackupPath(filename) {
  const backupDirPath = getBackupDirPath();
  const normalized = path.basename(String(filename || "").trim());

  if (!normalized || !normalized.endsWith(".sqlite")) {
    throw new Error("Backup filename must end with .sqlite");
  }

  const resolved = path.resolve(backupDirPath, normalized);

  if (!resolved.startsWith(`${backupDirPath}${path.sep}`) && resolved !== path.join(backupDirPath, normalized)) {
    throw new Error("Backup path is outside the configured backup directory");
  }

  return {
    backupDirPath,
    filename: normalized,
    path: resolved
  };
}

function validateSqliteFile(filePath) {
  const database = new Database(filePath, { readonly: true, fileMustExist: true });

  try {
    const integrity = database.pragma("integrity_check", { simple: true });

    if (integrity !== "ok") {
      throw new Error(`SQLite integrity check failed: ${integrity}`);
    }
  } finally {
    database.close();
  }
}

export async function listSystemBackups() {
  const sqliteFilePath = getSqliteFilePath();
  const backupDirPath = getBackupDirPath();

  await fs.mkdir(backupDirPath, { recursive: true });

  const [databaseStats, backupEntries] = await Promise.all([
    fs.stat(sqliteFilePath),
    fs.readdir(backupDirPath, { withFileTypes: true })
  ]);

  const files = await Promise.all(
    backupEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sqlite"))
      .map(async (entry) => {
        const filePath = path.join(backupDirPath, entry.name);
        const stats = await fs.stat(filePath);

        return {
          name: entry.name,
          path: filePath,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        };
      })
  );

  files.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

  return {
    sqliteFilePath,
    backupDirPath,
    database: {
      size: databaseStats.size,
      modifiedAt: databaseStats.mtime.toISOString()
    },
    backups: files
  };
}

export async function createSystemBackup(user) {
  const sqliteFilePath = getSqliteFilePath();
  const backupDirPath = getBackupDirPath();

  await fs.mkdir(backupDirPath, { recursive: true });

  const filename = formatBackupFilename();
  const destinationPath = path.join(backupDirPath, filename);

  await fs.copyFile(sqliteFilePath, destinationPath);

  const stats = await fs.stat(destinationPath);

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: user.id,
      userId: user.id,
      rawInput: `create backup ${filename}`,
      executionStatus: "backup_created",
      errorMessage: null,
      parsedResultJson: JSON.stringify({
        backup: {
          filename,
          destinationPath,
          size: stats.size
        }
      })
    }
  });

  return {
    filename,
    destinationPath,
    size: stats.size
  };
}

export async function restoreSystemBackup(user, filename) {
  const sqliteFilePath = getSqliteFilePath();
  const { path: sourcePath, filename: normalizedFilename } = resolveBackupPath(filename);

  await fs.access(sourcePath);
  validateSqliteFile(sourcePath);

  const preRestoreBackup = await createSystemBackup(user);
  let restoreVerified = false;

  try {
    await prisma.$disconnect();
    await fs.copyFile(sourcePath, sqliteFilePath);
    validateSqliteFile(sqliteFilePath);
    restoreVerified = true;
  } catch (error) {
    if (preRestoreBackup?.destinationPath) {
      await fs.copyFile(preRestoreBackup.destinationPath, sqliteFilePath);
    }

    throw error;
  } finally {
    if (!restoreVerified) {
      try {
        validateSqliteFile(sqliteFilePath);
      } catch {
        // If rollback validation fails, keep the original restore error surface.
      }
    }
  }

  const restoredStats = await fs.stat(sqliteFilePath);

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: user.id,
      userId: user.id,
      rawInput: `restore backup ${normalizedFilename}`,
      executionStatus: "backup_restored",
      errorMessage: null,
      parsedResultJson: JSON.stringify({
        restore: {
          sourceFilename: normalizedFilename,
          sourcePath,
          preRestoreBackup: preRestoreBackup.filename,
          restoredSize: restoredStats.size
        }
      })
    }
  });

  return {
    filename: normalizedFilename,
    sourcePath,
    restoredSize: restoredStats.size,
    preRestoreBackup: preRestoreBackup.filename
  };
}

export async function listOperationalOverview() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const operationalStatuses = [
    "backup_created",
    "backup_restored",
    "provider_api_key_rotated",
    "provider_missing",
    "provider_load_failed",
    "provider_http_error",
    "provider_timeout",
    "provider_network_error",
    "provider_response_invalid",
    "validation_failed",
    "command_on_cooldown",
    "dispatch_success",
    "network_error",
    "network_timeout",
    "http_error",
    "target_business_error",
    "duplicate_update_ignored"
  ];

  const [
    activeProviders,
    activeTargets,
    dispatchSuccess24h,
    dispatchFailures24h,
    pendingConfirmations,
    telegramReceived24h,
    providerErrors24h,
    operationalEvents
  ] = await Promise.all([
    prisma.llmProvider.count({ where: { status: "active" } }),
    prisma.target.count({ where: { status: "active" } }),
    prisma.commandExecution.count({
      where: {
        status: "dispatch_success",
        createdAt: { gte: since }
      }
    }),
    prisma.commandExecution.count({
      where: {
        status: "dispatch_failed",
        createdAt: { gte: since }
      }
    }),
    prisma.pendingTelegramAction.count({
      where: {
        status: "pending",
        expiresAt: { gt: new Date() }
      }
    }),
    prisma.auditLog.count({
      where: {
        actorType: "telegram",
        createdAt: { gte: since }
      }
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: since },
        executionStatus: {
          in: [
            "provider_missing",
            "provider_load_failed",
            "provider_http_error",
            "provider_timeout",
            "provider_network_error",
            "provider_response_invalid"
          ]
        }
      }
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { actorType: "admin" },
          {
            executionStatus: {
              in: operationalStatuses
            }
          }
        ]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20,
      include: {
        provider: {
          select: {
            id: true,
            providerKey: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      activeProviders,
      activeTargets,
      dispatchSuccess24h,
      dispatchFailures24h,
      pendingConfirmations,
      telegramReceived24h,
      providerErrors24h
    },
    events: operationalEvents.map((event) => ({
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      actorType: event.actorType,
      actorId: event.actorId,
      executionStatus: event.executionStatus,
      errorMessage: event.errorMessage,
      rawInput: event.rawInput,
      provider: event.provider,
      user: event.user
    }))
  };
}

export async function getRuntimeLoggingSettings() {
  return listRuntimeSettings();
}

export async function updateRuntimeLoggingSettings(user, { verboseServerLogs }) {
  const result = setVerboseServerLogsEnabled(Boolean(verboseServerLogs));

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: user.id,
      userId: user.id,
      rawInput: `set verbose_server_logs=${result.enabled}`,
      executionStatus: "runtime_logging_updated",
      errorMessage: null,
      parsedResultJson: JSON.stringify({
        settings: {
          verboseServerLogs: result.enabled,
          updatedAt: result.updatedAt
        }
      })
    }
  });

  return {
    verboseServerLogs: result.enabled,
    updatedAt: result.updatedAt
  };
}
