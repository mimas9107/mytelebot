import "@/lib/server-env";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function getBootstrapAdminCredentials() {
  const username = process.env.ADMIN_USER?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export async function ensureBootstrapAdmin() {
  const credentials = getBootstrapAdminCredentials();

  if (!credentials) {
    return { ready: false, reason: "missing_admin_env" };
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { username: credentials.username }
  });

  if (existingAdmin) {
    return { ready: true, userId: existingAdmin.id };
  }

  const admin = await prisma.user.create({
    data: {
      username: credentials.username,
      passwordHash: hashPassword(credentials.password),
      role: "admin",
      status: "active"
    }
  });

  return { ready: true, userId: admin.id };
}
