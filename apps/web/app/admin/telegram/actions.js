"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createTelegramAccount,
  deleteTelegramAccount,
  toggleTelegramAccountStatus,
  updateTelegramAccount
} from "@/lib/telegram";

function toMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function revalidateTelegramPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/telegram");
}

export async function createTelegramAccountAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await createTelegramAccount(formData);
    revalidateTelegramPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function toggleTelegramAccountStatusAction(formData) {
  await requireAdminSession();
  await toggleTelegramAccountStatus(String(formData.get("accountId") || ""));
  revalidateTelegramPages();
}

export async function updateTelegramAccountAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await updateTelegramAccount(formData);
    revalidateTelegramPages();
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function deleteTelegramAccountAction(formData) {
  await requireAdminSession();
  await deleteTelegramAccount(String(formData.get("accountId") || ""));
  revalidateTelegramPages();
}
