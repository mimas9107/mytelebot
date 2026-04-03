"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createSystemBackup,
  restoreSystemBackup,
  updateRuntimeLoggingSettings
} from "@/lib/system";

function toMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function createBackupAction(_previousState) {
  const user = await requireAdminSession();

  try {
    const backup = await createSystemBackup(user);
    revalidatePath("/admin");
    revalidatePath("/admin/system");
    revalidatePath("/admin/audit");

    return {
      ok: true,
      error: "",
      message: `Backup created: ${backup.filename}`,
      details: `size=${backup.size} bytes`
    };
  } catch (error) {
    return {
      ok: false,
      error: toMessage(error),
      message: "",
      details: ""
    };
  }
}

export async function restoreBackupAction(_previousState, formData) {
  const user = await requireAdminSession();

  try {
    const filename = String(formData.get("filename") || "").trim();
    const backup = await restoreSystemBackup(user, filename);
    revalidatePath("/admin");
    revalidatePath("/admin/system");
    revalidatePath("/admin/audit");

    return {
      ok: true,
      error: "",
      message: `Backup restored: ${backup.filename}`,
      details: `rollback backup=${backup.preRestoreBackup}`
    };
  } catch (error) {
    return {
      ok: false,
      error: toMessage(error),
      message: "",
      details: ""
    };
  }
}

export async function updateRuntimeLoggingAction(_previousState, formData) {
  const user = await requireAdminSession();

  try {
    const verboseServerLogs = String(formData.get("verboseServerLogs") || "") === "on";
    const result = await updateRuntimeLoggingSettings(user, { verboseServerLogs });

    revalidatePath("/admin");
    revalidatePath("/admin/system");
    revalidatePath("/admin/audit");

    return {
      ok: true,
      error: "",
      message: `Verbose server logs ${result.verboseServerLogs ? "enabled" : "disabled"}.`,
      details: `updatedAt=${result.updatedAt}`
    };
  } catch (error) {
    return {
      ok: false,
      error: toMessage(error),
      message: "",
      details: ""
    };
  }
}
