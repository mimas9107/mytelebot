ALTER TABLE "DeviceCommand" ADD COLUMN "cooldownSeconds" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PendingTelegramAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "providerId" TEXT,
    "rawInput" TEXT NOT NULL,
    "actionJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "cancelledAt" DATETIME,
    "executedAt" DATETIME,
    CONSTRAINT "PendingTelegramAction_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "DeviceCommand" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingTelegramAction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CommandExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandId" TEXT NOT NULL,
    "actorId" TEXT,
    "status" TEXT NOT NULL,
    "reasonCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommandExecution_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "DeviceCommand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PendingTelegramAction_token_key" ON "PendingTelegramAction"("token");
CREATE INDEX "PendingTelegramAction_telegramUserId_idx" ON "PendingTelegramAction"("telegramUserId");
CREATE INDEX "PendingTelegramAction_commandId_idx" ON "PendingTelegramAction"("commandId");
CREATE INDEX "PendingTelegramAction_status_idx" ON "PendingTelegramAction"("status");
CREATE INDEX "PendingTelegramAction_expiresAt_idx" ON "PendingTelegramAction"("expiresAt");
CREATE INDEX "CommandExecution_commandId_idx" ON "CommandExecution"("commandId");
CREATE INDEX "CommandExecution_createdAt_idx" ON "CommandExecution"("createdAt");
