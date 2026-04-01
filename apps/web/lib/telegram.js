import "@/lib/server-env";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyTelegramWebhookHeaders } from "./telegram-utils.mjs";

function getTelegramToken() {
  const token = process.env.TELEGRAM_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_TOKEN is required");
  }

  return token;
}

export function verifyTelegramWebhookRequest(request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");

  return verifyTelegramWebhookHeaders(expectedSecret, headerSecret);
}

export async function findTelegramAccount(telegramUserId) {
  return prisma.telegramAccount.findUnique({
    where: {
      telegramUserId: String(telegramUserId)
    }
  });
}

export async function recordTelegramUpdate({
  updateId,
  telegramUserId,
  messageText
}) {
  if (updateId === null || updateId === undefined || updateId === "") {
    return { duplicate: false, recorded: false };
  }

  const telegramUpdateId = String(updateId);
  const existing = await prisma.telegramUpdate.findUnique({
    where: { telegramUpdateId },
    select: { id: true }
  });

  if (existing) {
    return { duplicate: true, recorded: false };
  }

  await prisma.telegramUpdate.create({
    data: {
      telegramUpdateId,
      telegramUserId: telegramUserId ? String(telegramUserId) : null,
      messageText: messageText || null
    }
  });

  return { duplicate: false, recorded: true };
}

export async function sendTelegramMessage({ chatId, text }) {
  const token = getTelegramToken();
  const apiBaseUrl = (process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/$/, "");

  const response = await fetch(`${apiBaseUrl}/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }

  return response.json();
}

export async function createTelegramAuditLog({
  telegramUserId,
  text,
  status,
  errorMessage,
  providerId,
  parsedResult
}) {
  return prisma.auditLog.create({
    data: {
      actorType: "telegram",
      actorId: String(telegramUserId),
      rawInput: text,
      executionStatus: status,
      errorMessage: errorMessage || null,
      providerId: providerId || null,
      parsedResultJson: parsedResult ? JSON.stringify(parsedResult) : null
    }
  });
}

export async function createPendingTelegramAction({
  telegramUserId,
  chatId,
  commandId,
  providerId,
  rawInput,
  action
}) {
  const token = randomBytes(3).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  return prisma.pendingTelegramAction.create({
    data: {
      token,
      telegramUserId: String(telegramUserId),
      chatId: String(chatId),
      commandId,
      providerId: providerId || null,
      rawInput,
      actionJson: JSON.stringify(action),
      status: "pending",
      expiresAt
    }
  });
}

export async function findPendingTelegramAction({ token, telegramUserId }) {
  return prisma.pendingTelegramAction.findFirst({
    where: {
      token,
      telegramUserId: String(telegramUserId)
    },
    include: {
      command: {
        include: {
          device: {
            include: {
              target: true
            }
          }
        }
      }
    }
  });
}

export async function updatePendingTelegramActionStatus(id, status, timestampField) {
  return prisma.pendingTelegramAction.update({
    where: { id },
    data: {
      status,
      ...(timestampField ? { [timestampField]: new Date() } : {})
    }
  });
}

export async function recordCommandExecution({
  commandId,
  actorId,
  status,
  reasonCode
}) {
  return prisma.commandExecution.create({
    data: {
      commandId,
      actorId: actorId || null,
      status,
      reasonCode: reasonCode || null
    }
  });
}

export async function getLatestSuccessfulCommandExecution(commandId) {
  return prisma.commandExecution.findFirst({
    where: {
      commandId,
      status: "dispatch_success"
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function listTelegramAccounts() {
  return prisma.telegramAccount.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      user: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });
}

export async function listAdminUsers() {
  return prisma.user.findMany({
    where: {
      role: "admin",
      status: "active"
    },
    orderBy: {
      username: "asc"
    },
    select: {
      id: true,
      username: true,
      name: true
    }
  });
}

export async function createTelegramAccount(formData) {
  const telegramUserId = String(formData.get("telegramUserId") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const userId = String(formData.get("userId") || "").trim();

  if (!telegramUserId) {
    throw new Error("telegramUserId is required");
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true }
    });

    if (!user || user.role !== "admin" || user.status !== "active") {
      throw new Error("Linked admin user is invalid");
    }
  }

  await prisma.telegramAccount.create({
    data: {
      userId: userId || null,
      telegramUserId,
      username: username || null,
      displayName: displayName || null,
      status: "active"
    }
  });
}

export async function updateTelegramAccount(formData) {
  const accountId = String(formData.get("accountId") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const userId = String(formData.get("userId") || "").trim();

  if (!accountId) {
    throw new Error("accountId is required");
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true }
    });

    if (!user || user.role !== "admin" || user.status !== "active") {
      throw new Error("Linked admin user is invalid");
    }
  }

  await prisma.telegramAccount.update({
    where: { id: accountId },
    data: {
      userId: userId || null,
      username: username || null,
      displayName: displayName || null
    }
  });
}

export async function toggleTelegramAccountStatus(accountId) {
  const account = await prisma.telegramAccount.findUnique({
    where: { id: accountId },
    select: { id: true, status: true }
  });

  if (!account) {
    throw new Error("Telegram account not found");
  }

  await prisma.telegramAccount.update({
    where: { id: accountId },
    data: {
      status: account.status === "active" ? "inactive" : "active"
    }
  });
}

export async function deleteTelegramAccount(accountId) {
  await prisma.telegramAccount.delete({
    where: { id: accountId }
  });
}
