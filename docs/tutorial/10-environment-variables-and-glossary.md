# 10. 環境變數與術語速查

## 1. 先講結論

如果你在看這個專案時常常搞混：

- 哪些值是從 `.env` 來的
- 哪些值缺了會直接壞掉
- 哪些術語是什麼意思

這份文件就是速查表。

## 2. 常見環境變數

### `DATABASE_URL`

用途：

- Prisma 與 SQLite 的主要連線位置

例子：

```bash
DATABASE_URL=file:/opt/render/project/src/data/mytelebot.sqlite
```

### `SQLITE_FILE_PATH`

用途：

- SQLite 檔案路徑的備用設定

在這個專案裡，主要還是以 `DATABASE_URL` 為準。

### `SQLITE_BACKUP_DIR`

用途：

- system backup/restore 的備份目錄

### `ADMIN_USER`

用途：

- bootstrap admin 的帳號名稱

### `ADMIN_PASSWORD`

用途：

- bootstrap admin 的初始密碼

### `SESSION_SECRET`

用途：

- session cookie 的 HMAC 簽章 key

如果缺少它：

- session 建立會失敗
- 登入流程無法正常建立 cookie

你也可以把它理解成：

- 伺服器替 cookie 蓋章用的印章

如果沒有這個章，或有人偷偷改了 cookie 內容，例如把 `role` 從 `user` 改成 `admin`，伺服器就能立刻識破。

### `APP_ENCRYPTION_KEY`

用途：

- 加密 provider API key 與 target secret

如果缺少它：

- `encryptSecret()` / `decryptSecret()` 會直接丟錯

如果你改掉它：

- 先前已經存進 DB 的加密資料可能無法解密

對初學者來說，這裡也可以把它想成：

- 應用程式自己持有的保險箱鑰匙
- secret 在進資料庫前就先上鎖
- 不是等到 DB 被拿出來之後才補救

### `TELEGRAM_TOKEN`

用途：

- 呼叫 Telegram Bot API，例如 `sendMessage`

### `TELEGRAM_WEBHOOK_SECRET`

用途：

- 驗證 Telegram webhook header secret

建議：

- 正式部署一定要設

### `TELEGRAM_API_BASE_URL`

用途：

- 可選
- 預設是 `https://api.telegram.org`
- 本機或測試時可改指向 mock Telegram server

### `APP_URL`

用途：

- 應用的公開網址

補充：

- 這個值在目前 app 程式碼裡不是主要邏輯判斷來源
- 比較偏部署資訊、外部整合或未來擴充預留

### `RENDER_EXTERNAL_URL`

用途：

- Render 部署時的公開網址資訊

補充：

- 這個值也不是目前 app 業務邏輯直接依賴的核心環境變數
- 主要是平台提供的公開網址資訊

### `NODE_ENV`

用途：

- 控制環境模式，例如 development / production

### 其他你可能會在 `.env.example` 看到的值

例如：

- `HOME_GATEWAY_SHARED_SECRET`
- `SQLITE_BACKUP_USER`
- `SQLITE_BACKUP_PASSWORD`
- `NODE_VERSION`

這些值目前不是教學主流程中最核心的 app 執行入口。
有些是保留欄位，有些是部署或未來擴充用設定。

## 3. `.env` 是怎麼被程式讀到的

這個專案主要靠兩個地方：

- [`apps/web/lib/server-env.js`](/home/mimas/projects/mytelebot/apps/web/lib/server-env.js)
- [`apps/web/next.config.mjs`](/home/mimas/projects/mytelebot/apps/web/next.config.mjs)

它們都會協助從 workspace root 載入 `.env`。

補充一個工程上的觀念：

- 有些環境變數缺失，是在真正呼叫功能時才報錯
- 更成熟的做法通常是啟動時就先檢查關鍵值，這叫 fail fast

例如這個專案裡，`SESSION_SECRET` 和 `APP_ENCRYPTION_KEY` 都屬於很適合提早檢查的核心值。

## 4. 術語速查

### Monorepo

一個 repo 裡放多個子專案。

本專案目前是：

- root workspace
- `apps/web` 真正的 app
- `packages` 預留未來共用模組

### Workspace

由根目錄 `package.json` 管理的子專案集合。

### App Router

Next.js 以檔案路徑決定路由的系統。

### Route Handler

Next.js 內建 API route 寫法，例如：

- `/api/health`
- `/api/telegram/webhook`

### Server Action

由 HTML form 直接呼叫的伺服器函式。

### Client Component

帶 `"use client"` 的 React 元件。

### Server Component

App Router 預設的元件型態。

### ORM

用 JavaScript 存取資料庫的工具。

本專案用的是 `Prisma`。

### Adapter

讓 Prisma 知道如何與特定資料庫驅動溝通的橋接層。

本專案用的是：

- `@prisma/adapter-better-sqlite3`

### Webhook

外部服務主動把資料送到你的 URL。

本專案是 Telegram 打到：

- `/api/telegram/webhook`

### Dedupe

去重，避免同一筆 update 重複處理。

你可以把 Telegram 的 `update_id` 想成每封掛號信的編號。

系統把編號記下來，就是為了避免：

- 同一封信被處理兩次
- webhook 重送造成重複控制

### Intent

LLM 對訊息的判斷類型，例如：

- `device_control`
- `device_query`
- `chat`
- `reject`

### Registry

這裡不是 npm registry，而是設備與命令白名單資料。

### Alias

別名。

例如：

- `aircon`
- `ac`
- `客廳冷氣`

這些都可能指向同一台 `Device` 或同一個 `DeviceCommand`。

它的作用是讓：

- 人類輸入比較自然
- LLM 與驗證層比較容易對到正確鍵值

### Dispatch

把已驗證的命令轉成真正的 HTTP request 並送到 target API。

### Cooldown

冷卻時間。

如果某個 command 設了 cooldown，系統在短時間內會拒絕重複執行，以免：

- 連續重送同一命令
- 裝置被過度觸發
- webhook 重試造成副作用

### HMAC

一種用密鑰做簽章的方式。

在這個專案裡，你可以先把它理解成：

- 用來證明某段請求內容沒有被偷偷改掉
- 也是 session cookie 防篡改的關鍵機制

例如：

- cookie 裡寫著 `role=admin`
- 但沒有正確的 HMAC 簽章

系統就不會相信這份資料

### ALE

`Application-Level Encryption`，也就是應用層加密。

意思是：

- 資料在寫進資料庫之前就先加密
- 所以就算資料庫檔案外流，也不代表敏感值會直接被看到

### Masked request

把 request 內容裡的敏感資訊遮掉後，再拿去記錄或顯示。

例如：

- `Authorization: Bearer ***`
- `token=***`

## 5. 初學者最常見的混淆

### 密碼雜湊 vs secret 加密

- 密碼：`scrypt` 雜湊，不可還原
- API key / target secret：`AES-256-GCM` 加密，可解密還原

### `@/lib/prisma` 是 npm 套件嗎

不是。
它是 `apps/web/jsconfig.json` 設定的路徑別名。

### `file:./data/...` 與 `file:/abs/path/...` 有差嗎

有。

- 相對路徑會受到目前工作目錄影響
- 部署環境比較容易踩坑
- 絕對路徑通常比較穩
