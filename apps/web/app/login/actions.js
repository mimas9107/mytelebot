"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { ensureBootstrapAdmin } from "@/lib/auth/bootstrap";
import { createSession, clearSession } from "@/lib/auth/session";

export async function loginAction(_previousState, formData) {
  await ensureBootstrapAdmin();

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid credentials." };
  }

  if (user.status !== "active") {
    return { error: "This account is not active." };
  }

  await createSession({
    userId: user.id,
    role: user.role,
    username: user.username
  });

  redirect("/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
