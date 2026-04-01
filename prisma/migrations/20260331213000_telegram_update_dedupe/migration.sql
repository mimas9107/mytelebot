CREATE TABLE "TelegramUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUpdateId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "messageText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TelegramUpdate_telegramUpdateId_key" ON "TelegramUpdate"("telegramUpdateId");
