# 專案結構與模組規劃

## 1. 建議專案型態
建議使用 `npm workspaces` 的 monorepo，原因：
- 前端、Bot、核心邏輯可分層，但仍共用 schema 與型別
- 後續若要把 webhook 與 worker 分拆部署，成本較低

## 2. 建議目錄結構

```text
mytelebot/
  apps/
    web/
      app/
      components/
      lib/
      app/api/
    worker/
      src/
  packages/
    contracts/
      src/
    core/
      src/
    db/
      prisma/
      src/
    llm/
      src/
    telegram/
      src/
    device-registry/
      src/
    dispatcher/
      src/
  docs/
    architecture.md
    json-protocol.md
    project-structure.md
    sqlite-to-postgres-migration.md
  .env.example
  package.json
  README.md
```

## 3. 模組責任切分

### `apps/web`
負責：
- 管理後台 UI
- 原型版自建 session 登入流程
- API routes
- Telegram webhook endpoint
- 管理頁 CRUD
- audit、system、telegram allowlist 等原型功能頁

### `apps/worker`
負責：
- 非同步任務
- 重試與超時補償
- 排程任務
- 高延遲設備控制

第一版若要先簡化，可以暫時不建立 `worker`，但介面要預留。

### `packages/contracts`
負責：
- 所有共享 `zod` schemas
- API request/response contracts
- LLM output schema
- device command schema

這個模組應優先建立，避免前後端各自定義 JSON。

目前現況：
- 專案目前仍以 `apps/web` 單體模式實作
- `packages/*` 尚未拆出
- schema 驗證與 service logic 目前集中在 `apps/web/lib/*`
- `scripts/` 目前保存本機 smoke tool、mock target server、mock LLM server 與 webhook integration test runner

### `packages/db`
負責：
- Prisma schema
- migrations
- DB client
- repository functions

### `packages/llm`
負責：
- OpenAI-compatible client wrapper
- provider selection
- prompt builder
- structured output parsing

### `packages/telegram`
負責：
- Telegram adapter
- command routing
- reply formatting
- webhook verification

### `packages/device-registry`
負責：
- target/device/command 查詢
- prompt context builder
- command whitelist validation

### `packages/dispatcher`
負責：
- 將已驗證 action 轉為實際 HTTP request
- timeout、retry、error mapping
- audit log 回填

## 4. 建議資料表

### `users`
- `id`
- `email`
- `name`
- `role`
- `status`
- `created_at`

### `telegram_accounts`
- `id`
- `user_id`
- `telegram_user_id`
- `username`
- `display_name`
- `status`

### `llm_providers`
- `id`
- `name`
- `base_url`
- `model`
- `extra_headers_json`
- `api_key_secret_id`
- `status`
- `is_default`

### `secrets`
- `id`
- `secret_type`
- `encrypted_value`
- `created_at`
- `rotated_at`

### `targets`
- `id`
- `name`
- `base_url`
- `auth_type`
- `auth_secret_id`
- `timeout_ms`
- `status`

### `devices`
- `id`
- `target_id`
- `name`
- `aliases_json`
- `type`
- `description`
- `status`

### `device_commands`
- `id`
- `device_id`
- `command_id`
- `aliases_json`
- `method`
- `path`
- `payload_template_json`
- `args_schema_json`
- `confirmation_required`
- `status`

### `audit_logs`
- `id`
- `actor_type`
- `actor_id`
- `provider_id`
- `model`
- `raw_input`
- `parsed_result_json`
- `execution_status`
- `error_message`
- `created_at`

## 5. API 路由規劃

### 管理後台 API
- `POST /api/auth/*`
- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PATCH /api/admin/providers/:id`
- `POST /api/admin/providers/:id/test`
- `GET /api/admin/targets`
- `POST /api/admin/targets`
- `PATCH /api/admin/targets/:id`
- `GET /api/admin/devices`
- `POST /api/admin/devices`
- `PATCH /api/admin/devices/:id`
- `GET /api/admin/audit-logs`

### Bot API
- `POST /api/telegram/webhook`
- `POST /api/internal/execute-action`

## 6. 核心服務介面草案

### ProviderRouter
```js
async function getActiveProvider() {}
async function callStructuredLLM({ provider, systemPrompt, userInput, schema }) {}
```

### RegistryService
```js
async function buildDeviceContext() {}
async function validateAction(action) {}
```

### DispatcherService
```js
async function dispatchAction({ action, actor }) {}
async function dispatchBatch({ actions, actor }) {}
```

### TelegramService
```js
async function handleWebhook(update) {}
async function replyMessage({ chatId, text }) {}
```

## 7. 建議開發順序
1. 初始化 `Next.js` + `Prisma` + SQLite
2. 建立 `contracts` 與資料表 schema
3. 完成 bootstrap admin login 與 session
4. 完成 provider CRUD 與加密 secrets
5. 完成 target/device/command CRUD
6. 接上 Telegram webhook
7. 接上 LLM structured output
8. 完成 dispatcher、audit log、SQLite backup/restore API
9. 加入 queue、retry、confirmation flow

## 8. 環境變數草案

```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=$NODE_ENV
APP_URL=$APP_URL
DATABASE_URL=$DATABASE_URL
SQLITE_FILE_PATH=$SQLITE_FILE_PATH
SQLITE_BACKUP_DIR=$SQLITE_BACKUP_DIR
ADMIN_USER=
ADMIN_PASSWORD=
SESSION_SECRET=
APP_ENCRYPTION_KEY=
TELEGRAM_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
RENDER_EXTERNAL_URL=
HOME_GATEWAY_SHARED_SECRET=
```

目前現況補充：
- 本機 smoke 測試可使用 `npm run smoke:webhook`
- 詳細測試標準已整理於 `docs/testing-standard.md`

## 9. 實作時要堅持的邊界
- `apps/web` 不直接拼接設備 payload 細節，應交給 `dispatcher`
- `telegram` 模組不直接呼叫資料庫細節，應走 `core` 或 service layer
- `llm` 模組不可持有設備實際 secret
- `contracts` 應作為唯一 JSON 真相來源

## 10. 先做與先不要做
先做：
- 單一 bot
- 單一 admin
- 單一 active provider
- 結構化控制指令
- 白名單設備控制

先不要做：
- 任意 plugin 安裝
- 自由格式 function calling
- 讓 LLM 自己發 HTTP request
- 將設備密鑰暴露給前端
