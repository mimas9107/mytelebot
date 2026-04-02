# MyTeleBot 初學者教學索引

這一組文件是給「看得懂基本程式碼，但還不熟 `Next.js`、`Prisma`、`SQLite`、`Server Actions`、`Telegram webhook`」的人讀的。

目標不是把所有術語講成教科書，而是幫你建立一張可以反覆對照程式碼的地圖。

建議閱讀順序：

1. [01-overview.md](./01-overview.md)
2. [02-runtime-and-stack.md](./02-runtime-and-stack.md)
3. [03-entry-points-and-folders.md](./03-entry-points-and-folders.md)
4. [04-data-model-and-prisma.md](./04-data-model-and-prisma.md)
5. [05-login-and-admin-flow.md](./05-login-and-admin-flow.md)
6. [06-telegram-webhook-flow.md](./06-telegram-webhook-flow.md)
7. [07-provider-registry-and-dispatch.md](./07-provider-registry-and-dispatch.md)
8. [08-api-inventory.md](./08-api-inventory.md)
9. [09-how-to-read-the-code.md](./09-how-to-read-the-code.md)

如果你只想先快速建立全貌，先讀：

- [01-overview.md](./01-overview.md)
- [03-entry-points-and-folders.md](./03-entry-points-and-folders.md)
- [06-telegram-webhook-flow.md](./06-telegram-webhook-flow.md)

如果你最在意資料庫與資料流，先讀：

- [04-data-model-and-prisma.md](./04-data-model-and-prisma.md)
- [05-login-and-admin-flow.md](./05-login-and-admin-flow.md)
- [07-provider-registry-and-dispatch.md](./07-provider-registry-and-dispatch.md)

## 你會在這組文件看到什麼

- 專案的簡易架構圖
- `Next.js App Router` 在這個專案裡實際扮演什麼角色
- `Server Actions`、`Route Handlers`、`lib/*` 的分工
- `Prisma` 在這個專案中的角色
- `SQLite` 怎麼被使用
- Telegram 訊息怎麼一路流到 LLM、白名單驗證、設備 dispatch
- 管理頁表單怎麼把資料寫進資料庫
- 每個 API 與主要頁面的入口索引

## 先修正幾個常見用語

這裡先把幾個容易講混的詞修正成比較準確、但初學者也能懂的說法：

- `前端`：這個專案不只是前端。它同時包含頁面 UI、後端 API、登入邏輯、資料庫存取。
- `後端 API`：這裡不是獨立 Express server，而是 `Next.js Route Handlers`。
- `ORM`：可以先理解成「用 JavaScript 操作資料表的工具」。本專案用的是 `Prisma`。
- `Server Action`：可以先理解成「從表單直接呼叫的伺服器函式」。
- `webhook`：外部服務主動把資料打到你的某個 URL。這裡指 Telegram 打到 `/api/telegram/webhook`。
- `provider`：這裡指 LLM 供應商或 OpenAI-compatible API 端點，不是 Telegram provider。
- `registry`：這裡不是 npm registry，而是「設備與命令白名單資料庫」。

## 目前專案的一句話版本

MyTeleBot 是一個用 `Next.js` 做成的單體應用：

- 有管理後台
- 有登入系統
- 有 Telegram webhook API
- 有 `Prisma + SQLite` 資料庫
- 有 LLM provider 設定
- 有 target / device / command 白名單
- 能把 Telegram 自然語言訊息轉成安全、受控的設備控制請求
