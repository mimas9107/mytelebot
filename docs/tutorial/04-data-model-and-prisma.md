# 04. 資料模型、Prisma 與 SQLite

## 1. Prisma 在這個專案中的角色

`Prisma` 在這裡不是資料庫本身，而是資料庫操作層。

它扮演三個角色：

1. 定義資料表結構
2. 產生 JavaScript client
3. 讓程式用 JavaScript 查資料與寫資料

最重要的檔案是：

- `prisma/schema.prisma`
- `apps/web/lib/prisma.js`

## 2. `schema.prisma` 是資料結構的總地圖

你可以把 `prisma/schema.prisma` 當成資料模型的總表。

在這個專案裡，重要模型有：

- `User`
- `TelegramAccount`
- `TelegramUpdate`
- `PendingTelegramAction`
- `LlmProvider`
- `Secret`
- `Target`
- `Device`
- `DeviceCommand`
- `CommandExecution`
- `AuditLog`

## 3. 各模型在實務上的用途

### `User`

用途：

- 管理後台登入帳號
- 記錄角色與狀態

重要欄位：

- `username`
- `passwordHash`
- `role`
- `status`

### `TelegramAccount`

用途：

- bot allowlist
- 哪些 Telegram user 可以使用這個 bot

重要欄位：

- `telegramUserId`
- `username`
- `displayName`
- `status`
- `userId`

### `TelegramUpdate`

用途：

- 記錄 Telegram `update_id`
- 避免同一個更新被重複處理

這就是 dedupe 機制。

### `PendingTelegramAction`

用途：

- 存「等待使用者確認」的命令

例如高風險命令要求：

```text
confirm ABC123
```

就會先存一筆 pending action。

### `LlmProvider`

用途：

- 記錄可用的 LLM provider

重要欄位：

- `providerKey`
- `baseUrl`
- `model`
- `extraHeadersJson`
- `capabilitiesJson`
- `apiKeySecretId`
- `status`
- `isDefault`

### `Secret`

用途：

- 存加密後的敏感資料

目前主要用於：

- provider API key
- target auth secret

重點：

- 明文 secret 不直接存在 provider 或 target 資料表中

### `Target`

用途：

- 一個設備 API 目標伺服器

你可以把它想成一組設備的入口站台。

重要欄位：

- `targetKey`
- `baseUrl`
- `authType`
- `authSecretId`
- `timeoutMs`

### `Device`

用途：

- 目標站台底下的一台設備

例如：

- 客廳冷氣
- 臥室燈
- 車庫門

### `DeviceCommand`

用途：

- 這台設備允許執行的命令

例如：

- `turn_on`
- `set_temperature`
- `lock`

重要欄位：

- `method`
- `path`
- `payloadTemplateJson`
- `argsSchemaJson`
- `confirmationRequired`
- `cooldownSeconds`

### `CommandExecution`

用途：

- 記錄命令執行結果
- 用於 cooldown 與操作追蹤

### `AuditLog`

用途：

- 記錄整體流程中的事件

例如：

- Telegram 收到訊息
- provider 解析失敗
- validation 失敗
- dispatch 成功
- backup 建立
- API key rotation

## 4. 關聯圖

```text
User
  ├─< TelegramAccount
  └─< AuditLog

LlmProvider
  ├─(optional) -> Secret
  ├─< AuditLog
  └─< PendingTelegramAction

Target
  ├─(optional) -> Secret
  └─< Device
       └─< DeviceCommand
            ├─< PendingTelegramAction
            └─< CommandExecution
```

## 5. `apps/web/lib/prisma.js` 在做什麼

目前這個檔案很重要，因為它建立 Prisma client。

核心片段：

```js
const sqliteUrl =
  process.env.DATABASE_URL ||
  `file:${process.env.SQLITE_FILE_PATH || "./data/mytelebot.sqlite"}`;

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"]
  });
}
```

這段代表：

1. 資料庫位置主要由 `DATABASE_URL` 決定
2. SQLite driver adapter 是 `@prisma/adapter-better-sqlite3`
3. 專案最後得到一個 `prisma` 物件給全專案共用

## 6. 為什麼需要 adapter

這個專案目前的 Prisma client 實際需要 SQLite adapter，所以不是單純：

```js
new PrismaClient()
```

而是：

```js
new PrismaClient({ adapter })
```

你可以先把它理解成：

- Prisma 是通用 ORM 介面
- adapter 是讓 Prisma 知道「這次如何跟 SQLite 溝通」

## 7. Prisma 在程式裡怎麼被用

最常見的用法：

### 查單筆

```js
const user = await prisma.user.findUnique({
  where: { username }
});
```

### 建立資料

```js
await prisma.telegramAccount.create({
  data: {
    telegramUserId,
    status: "active"
  }
});
```

### 更新資料

```js
await prisma.llmProvider.update({
  where: { id: providerId },
  data: { isDefault: true }
});
```

### 交易

```js
await prisma.$transaction(async (tx) => {
  // 多步資料更新
});
```

### 計數

```js
await prisma.auditLog.count()
```

## 8. SQLite 在這個專案中的角色

SQLite 是目前的實際資料庫。

優點：

- 快速
- 容易部署
- 適合單機原型

限制：

- 是檔案型資料庫
- 多副本部署不適合
- 在 Render free plan 不持久

## 9. 這個專案中的 SQLite 路徑觀念

你最近部署時已經踩過一個非常重要的點：

- 相對路徑容易出錯
- build / migrate / runtime 的工作目錄可能不同
- 因此部署環境要盡量用絕對路徑

例如 Render free demo：

```bash
DATABASE_URL=file:/opt/render/project/src/data/mytelebot.sqlite
```

## 10. 資料模型傳遞流程

### 例子 A：登入

```text
Login form
-> loginAction
-> prisma.user.findUnique
-> verifyPassword
-> createSession
```

### 例子 B：建立 provider

```text
Admin form
-> createProviderAction
-> createProvider(formData)
-> prisma.secret.create
-> prisma.llmProvider.create
```

### 例子 C：Telegram 命令

```text
Webhook route
-> findTelegramAccount
-> getActiveProvider
-> buildLlmRegistryContext
-> validateLlmActions
-> dispatchValidatedAction
-> createTelegramAuditLog
-> recordCommandExecution
```

## 11. 初學者要怎麼讀 Prisma 相關程式碼

建議順序：

1. 先看 `schema.prisma`
2. 再看 `apps/web/lib/prisma.js`
3. 然後看某個功能模組如何呼叫 `prisma`

例如：

- 想懂登入，就看 `User`
- 想懂 allowlist，就看 `TelegramAccount`
- 想懂設備控制，就看 `Target`、`Device`、`DeviceCommand`
- 想懂紀錄，就看 `AuditLog`、`CommandExecution`
