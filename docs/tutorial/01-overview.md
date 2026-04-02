# 01. 專案全貌

## 1. 這個專案到底在做什麼

這個專案想做的是：

1. 使用者在 Telegram 對 bot 說一句自然語言
2. 系統把這句話交給 LLM 解析成結構化命令
3. 系統確認這個命令有沒有命中已註冊的裝置與命令白名單
4. 若通過，就呼叫真正的設備 API
5. 最後把結果回傳到 Telegram，並留下 audit log

同時，管理者可以在網站後台管理：

- 管理員登入
- LLM provider 設定
- target / device / command 白名單
- Telegram allowlist
- audit logs
- 系統備份與 health/metrics

## 2. 最重要的觀念

這個專案不是「LLM 想打哪個 URL 就打哪個 URL」。

它的安全設計是：

- LLM 只能輸出 `target_key`、`device_key`、`command_key`、`args`
- 真正的 `baseUrl`、HTTP `method`、`path`、payload 模板，都由伺服器端資料庫決定
- 即使 LLM 給了看起來合理的裝置名稱，後端還是會再驗證

這樣做的原因是避免：

- LLM 幻覺亂猜裝置
- LLM 亂組 payload
- LLM 直接形成任意外部請求

## 3. 簡易架構圖

```text
Browser Admin UI
    |
    v
Next.js Pages + Server Actions
    |
    v
apps/web/lib/*
    |
    +--> Prisma --> SQLite
    |
    +--> fetch --> LLM Provider API
    |
    +--> fetch --> Target Device API
    |
    +--> fetch --> Telegram Bot API

Telegram Cloud
    |
    v
/api/telegram/webhook
    |
    v
telegram -> llm -> registry -> dispatcher -> telegram reply
```

## 4. 你可以把它先理解成 4 個子系統

### A. 管理後台

用途：

- 讓管理者登入
- 設定 provider
- 設定 target/device/command
- 查看審計紀錄

主要檔案：

- `apps/web/app/admin/*`
- `apps/web/lib/auth/*`
- `apps/web/lib/providers.js`
- `apps/web/lib/registry.js`
- `apps/web/lib/audit.js`
- `apps/web/lib/system.js`

### B. Telegram webhook 子系統

用途：

- 接收 Telegram 更新
- 驗證允許名單
- 解析命令
- 執行控制
- 回 Telegram 訊息

主要檔案：

- `apps/web/app/api/telegram/webhook/route.js`
- `apps/web/lib/telegram.js`
- `apps/web/lib/llm.js`
- `apps/web/lib/registry.js`
- `apps/web/lib/dispatcher.js`

### C. 資料庫與資料模型

用途：

- 存使用者
- 存 Telegram allowlist
- 存 provider
- 存 secrets
- 存 target/device/command
- 存 audit log 與 command execution

主要檔案：

- `prisma/schema.prisma`
- `apps/web/lib/prisma.js`

### D. 系統維運功能

用途：

- health endpoints
- metrics
- SQLite backup/restore

主要檔案：

- `apps/web/app/api/health/*`
- `apps/web/app/api/metrics/route.js`
- `apps/web/lib/system.js`

## 5. 目前真正的主流程是什麼

如果只挑一條最重要的主流程，就是：

```text
Telegram message
-> webhook route
-> allowlist check
-> provider load
-> LLM parse
-> whitelist validation
-> cooldown / confirmation
-> dispatch target API
-> write audit log
-> reply to Telegram
```

如果只挑一條最重要的管理流程，就是：

```text
Admin login
-> create session cookie
-> open /admin
-> submit HTML form
-> Server Action
-> lib service
-> Prisma
-> SQLite
-> revalidate page
```

## 6. 先不要把它想得太複雜

對初學者來說，可以先把整個專案拆成三層：

1. `app/`
   這層放頁面、API route、server actions

2. `lib/`
   這層放真正的商業邏輯

3. `prisma/schema.prisma`
   這層定義資料表長什麼樣

很多時候讀程式就照這個順序：

頁面或 API 入口
-> 呼叫哪個 `lib` 函式
-> 那個函式查了哪些資料表

這樣就不容易迷路。
