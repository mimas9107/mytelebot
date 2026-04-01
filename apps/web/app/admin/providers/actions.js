"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createProvider,
  deleteProvider,
  rotateProviderApiKey,
  setDefaultProvider,
  testProviderConnection,
  toggleProviderStatus,
  updateProvider
} from "@/lib/providers";

function toMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function createProviderAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await createProvider(formData);
    revalidatePath("/admin");
    revalidatePath("/admin/providers");

    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function setDefaultProviderAction(formData) {
  await requireAdminSession();
  await setDefaultProvider(String(formData.get("providerId") || ""));
  revalidatePath("/admin");
  revalidatePath("/admin/providers");
}

export async function updateProviderAction(_previousState, formData) {
  await requireAdminSession();

  try {
    await updateProvider(formData);
    revalidatePath("/admin");
    revalidatePath("/admin/providers");

    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}

export async function rotateProviderApiKeyAction(_previousState, formData) {
  const user = await requireAdminSession();

  try {
    await rotateProviderApiKey(formData, user);
    revalidatePath("/admin");
    revalidatePath("/admin/providers");
    revalidatePath("/admin/audit");

    return {
      ok: true,
      error: "",
      message: "Provider API key rotated.",
      details: "Previous secret kept as rotated history."
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

export async function toggleProviderStatusAction(formData) {
  await requireAdminSession();
  await toggleProviderStatus(String(formData.get("providerId") || ""));
  revalidatePath("/admin");
  revalidatePath("/admin/providers");
}

export async function deleteProviderAction(formData) {
  await requireAdminSession();
  await deleteProvider(String(formData.get("providerId") || ""));
  revalidatePath("/admin");
  revalidatePath("/admin/providers");
}

export async function testProviderConnectionAction(_previousState, formData) {
  await requireAdminSession();

  try {
    const result = await testProviderConnection(String(formData.get("providerId") || ""));
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
