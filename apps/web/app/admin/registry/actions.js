"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createDevice,
  createDeviceCommand,
  createTarget,
  deleteCommand,
  deleteDevice,
  deleteTarget,
  dryRunCommand,
  testTargetConnection,
  toggleCommandStatus,
  toggleDeviceStatus,
  toggleTargetStatus,
  updateDeviceCommand,
  updateDevice,
  updateTarget
} from "@/lib/registry";

function toMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function revalidateRegistryPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/registry");
}

export async function createTargetAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await createTarget(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function createDeviceAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await createDevice(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function updateTargetAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await updateTarget(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function createCommandAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await createDeviceCommand(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function updateDeviceAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await updateDevice(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function updateCommandAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await updateDeviceCommand(formData);
    revalidateRegistryPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function testTargetConnectionAction(_previousState, formData) {
  await requireAdminSession();

  try {
    const result = await testTargetConnection(String(formData.get("targetId") || ""));
    return {
      ok: result.ok,
      error: result.ok ? "" : result.message,
      message: result.message,
      details: [
        `reachable=${result.reachable}`,
        `status=${result.status ?? "none"}`,
        `endpoint=${result.endpoint}`
      ].join(" | ")
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

export async function dryRunCommandAction(_previousState, formData) {
  await requireAdminSession();

  try {
    const result = await dryRunCommand(formData);
    return {
      ok: true,
      error: "",
      message: "Dry-run rendered successfully.",
      details: JSON.stringify(result, null, 2)
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

export async function toggleTargetStatusAction(formData) {
  await requireAdminSession();
  await toggleTargetStatus(String(formData.get("targetId") || ""));
  revalidateRegistryPages();
}

export async function toggleDeviceStatusAction(formData) {
  await requireAdminSession();
  await toggleDeviceStatus(String(formData.get("deviceId") || ""));
  revalidateRegistryPages();
}

export async function toggleCommandStatusAction(formData) {
  await requireAdminSession();
  await toggleCommandStatus(String(formData.get("commandId") || ""));
  revalidateRegistryPages();
}

export async function deleteTargetAction(formData) {
  await requireAdminSession();
  await deleteTarget(String(formData.get("targetId") || ""));
  revalidateRegistryPages();
}

export async function deleteDeviceAction(formData) {
  await requireAdminSession();
  await deleteDevice(String(formData.get("deviceId") || ""));
  revalidateRegistryPages();
}

export async function deleteCommandAction(formData) {
  await requireAdminSession();
  await deleteCommand(String(formData.get("commandId") || ""));
  revalidateRegistryPages();
}
