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
- `prisma.config.ts`

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
- `email`
- `name`
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

你可以把它看成一張「已處理 update_id 清單」。

補充：

- `TelegramUpdate` 主要是為了 dedupe
- 它沒有接在主要的 `Target -> Device -> DeviceCommand` 業務關聯鏈上
- 所以你在關聯圖裡沒看到它，不是漏畫，而是刻意簡化

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

- `name`
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
- 除非你明確去查 `Secret`，否則一般 `findMany()` 不會把真正的 API key 一起帶出去

如果把明文 API key 直接放在主表，最壞的情況會是：

- DB 洩漏時直接暴露可用憑證
- 金鑰輪替歷史不好保存
- provider 資料與秘密資料混在一起，不利審計
- 後台列表或一般查詢很容易意外把 secret 帶到前端

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

重要欄位：

- `targetId`
- `deviceKey`
- `label`
- `type`
- `description`
- `aliasesJson`
- `status`

### `DeviceCommand`

用途：

- 這台設備允許執行的命令

例如：

- `turn_on`
- `set_temperature`
- `lock`

重要欄位：

- `deviceId`
- `commandKey`
- `label`
- `aliasesJson`
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

補充：

- `TelegramUpdate` 是較獨立的 dedupe 記錄表，不在這張主關聯圖裡

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

但要注意，上面只是簡化版片段。
實際程式碼還多了一層 lazy initialization 與 `Proxy` 包裝。

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

## 7. `Proxy`、`globalThis` 與 lazy initialization 是什麼

實際的 [`apps/web/lib/prisma.js`](/home/mimas/projects/mytelebot/apps/web/lib/prisma.js) 不只是直接建立一個 PrismaClient，還做了兩件事：

### A. 用 `globalThis` 快取 instance

```js
const globalForPrisma = globalThis;
```

這樣做的目的是：

- 在開發模式或模組重載時
- 避免重複建立太多 Prisma client

### B. 用 `Proxy` 延後初始化

實際 export 的 `prisma` 是：

```js
export const prisma = new Proxy(...)
```

你可以先不用深究 `Proxy` 語法細節。
初學者只要先知道：

- `import { prisma }` 之後，平常還是直接當 Prisma client 用
- 真正的 client 會在第一次需要時才建立

換句話說，這是一個「延遲初始化」技巧。

## 8. `prisma.config.ts` 是什麼

根目錄的 [`prisma.config.ts`](/home/mimas/projects/mytelebot/prisma.config.ts) 是 Prisma CLI 的設定檔。

它主要告訴 Prisma：

- schema 在哪裡
- migrations 在哪裡
- datasource URL 從哪裡拿

雖然副檔名是 `.ts`，但這不代表整個專案主體是 TypeScript。

## 9. Prisma 在程式裡怎麼被用

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

## 10. `encryption.js` 在做什麼

檔案：

- [`apps/web/lib/encryption.js`](/home/mimas/projects/mytelebot/apps/web/lib/encryption.js)

它負責：

- `encryptSecret(value)`
- `decryptSecret(payload)`
- `maskSecret(value)`

目前使用的對稱加密演算法是 `AES-256-GCM`。

如果你第一次看到這個名詞，可以先這樣理解：

- `AES-256` 像很堅固的保險箱
- `GCM` 像保險箱外面的防拆封條

意思是：

- 沒有鑰匙的人很難看到內容
- 如果有人偷偷改動密文，解密時也會被發現並拒絕處理

加密金鑰來自：

- `APP_ENCRYPTION_KEY`

這個值如果沒有設定，系統會直接丟錯。
如果你改掉這個值，之前已經加密存進 DB 的 secret 也可能無法再解密。

## 11. 密碼雜湊與 secret 加密是兩件不同的事

這裡很容易混淆，所以要分開記：

### 密碼

檔案：

- [`apps/web/lib/password.js`](/home/mimas/projects/mytelebot/apps/web/lib/password.js)

使用的是 `scrypt` 雜湊。

重點：

- 是單向的
- 不能把雜湊值還原成原密碼

### API key / target secret

檔案：

- [`apps/web/lib/encryption.js`](/home/mimas/projects/mytelebot/apps/web/lib/encryption.js)

使用的是可解密的對稱加密。

重點：

- 因為系統之後真的要拿它去呼叫 provider / target API
- 所以它必須能被還原

這也可以理解成一種應用層加密：

- 資料在寫進資料庫前就先被加密
- 就算有人只拿到 SQLite 檔案，也看不到原始 API key

## 12. SQLite 在這個專案中的角色

SQLite 是目前的實際資料庫。

優點：

- 快速
- 容易部署
- 適合單機原型

限制：

- 是檔案型資料庫
- 多副本部署不適合
- 在 Render free plan 不持久

## 13. 這個專案中的 SQLite 路徑觀念

你最近部署時已經踩過一個非常重要的點：

- 相對路徑容易出錯
- build / migrate / runtime 的工作目錄可能不同
- 因此部署環境要盡量用絕對路徑

例如 Render free demo：

```bash
DATABASE_URL=file:/tmp/data/mytelebot.sqlite
SQLITE_FILE_PATH=/tmp/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/tmp/data/backups
```

但要非常注意：

- `/tmp/...` 只是 Render 免費版 demo 比較不容易踩到舊檔案殘留的做法
- 它不是持久化儲存
- instance restart / redeploy / rebuild 後都要假設 SQLite 與 backups 會被清空
- 如果要真正保留資料，應改用 Persistent Disk 例如 `/var/data/...`，或改用外部資料庫

## 14. 資料模型傳遞流程

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

## 15. 初學者要怎麼讀 Prisma 相關程式碼

建議順序：

1. 先看 `schema.prisma`
2. 再看 `apps/web/lib/prisma.js`
3. 然後看某個功能模組如何呼叫 `prisma`

例如：

- 想懂登入，就看 `User`
- 想懂 allowlist，就看 `TelegramAccount`
- 想懂設備控制，就看 `Target`、`Device`、`DeviceCommand`
- 想懂紀錄，就看 `AuditLog`、`CommandExecution`

## 16. 不是所有資料庫層操作都一定走 Prisma

大多數業務資料存取都走 Prisma，但這個專案有一個例外很值得知道：

- [`apps/web/lib/system.js`](/home/mimas/projects/mytelebot/apps/web/lib/system.js)

這個模組在做 SQLite backup / restore / integrity check 時，會直接使用 `better-sqlite3`。

原因是這類工作比較接近：

- 資料庫檔案層級操作
- 備份檔驗證
- 不是單純資料表 CRUD

所以可以這樣記：

- 平常查表、寫表：主要用 Prisma
- 資料庫檔案維運：有些地方直接用 SQLite driver
