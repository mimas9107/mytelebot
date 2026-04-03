# MyTeleBot

Version: `1.0.3`

可部署於 `Render` 或 `Vercel` 的 Telegram Bot + 管理後台原型，目標是做可抽換 LLM 與可控設備白名單的移動助手。

## 備份與 Git 歷史註記
- 目前可辨識版本：`1.0.3`
- 本專案在此版本之後，預計會先做專案打包備份。
- 在上傳 GitHub 前，現有 `.git` 歷史會被移除並重新初始化，以清除早期敏感資訊歷史。
- 因此後續公開倉庫若看不到目前本地 commit 歷史，應以 `CHANGELOG.md` 與 `README.md` 中的版本註記作為銜接基準。
- 若需回溯此階段功能範圍，請以版本 `1.0.3` 為備份與重新初始化前的對照點。

## 文件索引
- `docs/architecture.md`: 整體系統目標、技術堆疊、部署方式、資料流與安全邊界
- `docs/json-protocol.md`: LLM 設定、家電目標定義、Telegram 與內部控制 JSON 溝通協定
- `docs/project-structure.md`: 建議目錄架構、模組責任、開發順序與環境變數規劃
- `docs/mvp-environment-setup.md`: 本機與 Render-first 原型環境初始化清單
- `docs/render-deployment-env.md`: Render 部署需求、Persistent Disk、SQLite 備份策略與環境變數
- `docs/sqlite-to-postgres-migration.md`: SQLite 遷移到 PostgreSQL 的切換步驟、風險與演練建議
- `docs/testing-standard.md`: 本機測試最低標準、smoke test 與報告規範
- `docs/getting-started-beginner.md`: 完全新手版本機啟動、安裝與第一輪操作說明
- `docs/deployment-checklist-beginner.md`: 完全新手版 Render 部署前檢查清單

## 目前完成進度
- 管理員登入與 session cookie 保護
- Provider Registry（新增、啟用/停用、設 default、刪除）
- Provider edit flow（名稱、base URL、model、headers、capabilities、API key）
- Provider API key rotation flow with history
- Webhook error classification with target business error support
- Provider capability profile / JSON strictness options
- Device Registry
- Device alias 白名單與 device edit
- Command alias 白名單與 command edit
- Target edit flow（名稱、base URL、auth type、timeout、auth secret）
- Command dry-run（渲染最終 method / URL / headers / payload，不實際 dispatch）
- `authType=hmac` dispatcher 與 target health check
- `confirmationRequired` Telegram 二次確認流程
- Command cooldown / rate limit（以 command-level cooldown 實作）
- Health endpoints：`/api/health`, `/api/health/db`, `/api/health/targets`
- Structured operational metrics and recent operational events
- SQLite-to-PostgreSQL migration path documentation
- SQLite restore UI with pre-restore backup and integrity checks
- SQLite backup upload flow with optional immediate restore
- Target / Device / Command 三層 CRUD 與狀態切換
- Telegram allowlist 管理
- Telegram allowlist 與 admin user link
- Telegram webhook 入口與 secret token 驗證
- Telegram `update_id` 去重保護
- LLM 結構化解析（OpenAI-compatible chat completions）
- 解析後白名單驗證
- 原始文字明確裝置命中檢查
- MVP dispatcher（實際呼叫 target API）
- Audit log UI（含 request / response drill-down）
- Mock target device server
- Webhook smoke test tool with auto-incrementing `update_id`
- Webhook integration test fixture runner
- Full message-flow integration test with local mock Telegram outbound capture
- Mock Telegram outbound server for reply-chain verification
- Core unit / contract / fixture test scripts for parser, registry, dispatcher, and Telegram helpers
- SQLite backup 建立與備份列表頁
- SQLite + Prisma + secrets 加密存放

## 本機啟動
```bash
cd ~/projects/mytelebot
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_VERSION"

npm install
npm exec -- prisma generate
npm run dev
```

## Webhook smoke 測試工具
可用本機腳本直接送 Telegram webhook 測試資料，並自動遞增 `update_id`：

```bash
cd ~/projects/mytelebot
export TELEGRAM_WEBHOOK_SECRET='your-secret'

npm run smoke:webhook -- "把light_01打開"
npm run smoke:webhook -- "把燈關掉"
npm run test:integration:webhook
npm run test:integration:message-flow
npm run test:core
REPORT_DATE=20260401 npm run test:report:core
REPORT_DATE=20260401 npm run test:report:message-flow
```

可用環境變數：
- `WEBHOOK_URL`: 預設 `$APP_URL/api/telegram/webhook`
- `TELEGRAM_WEBHOOK_SECRET` 或 `WEBHOOK_SECRET`: webhook secret
- `TELEGRAM_TEST_CHAT_ID`: 預設 `8270697521`
- `TELEGRAM_TEST_FROM_ID`: 預設同 `TELEGRAM_TEST_CHAT_ID`
- `TELEGRAM_TEST_FIRST_NAME`: 預設 `Test`
- `STATE_FILE`: 預設 `/tmp/mytelebot-webhook-update-id`
- `UPDATE_ID`: 若要手動指定固定 `update_id` 以驗證 dedupe，可直接覆寫

## Mock target 測試端
可先啟動本機假裝置，讓 dispatcher 有穩定測試目標：

```bash
cd ~/projects/mytelebot
MOCK_DEVICE_PORT=8000 \
MOCK_DEVICE_AUTH_TYPE=bearer \
MOCK_DEVICE_AUTH_SECRET='dev-secret' \
npm run mock:device
```

Target 可對應設定：
- `Base URL`: `http://127.0.0.1:8000`
- `Auth type`: `bearer`
- `Auth secret`: `dev-secret`

可用端點：
- `GET /health`
- `POST /device/<device_id>`
- `PUT /device/<device_id>`
- `PATCH /device/<device_id>`

## Mock LLM 測試端
可用本機 OpenAI-compatible 假服務驗證 webhook / registry 主流程：

```bash
cd ~/projects/mytelebot
MOCK_LLM_PORT=11435 npm run mock:llm
```

可用端點：
- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`

## Mock Telegram 測試端
可用本機 outbound stub 驗證 bot 回覆訊息內容，不需真的打到 Telegram Cloud：

```bash
cd ~/projects/mytelebot
MOCK_TELEGRAM_PORT=19000 npm run mock:telegram
```

可用端點：
- `GET /health`
- `GET /messages`
- `POST /reset`
- `POST /bot<TOKEN>/sendMessage`

## 必要環境變數
- `DATABASE_URL`
- `SQLITE_FILE_PATH`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `APP_ENCRYPTION_KEY`
- `TELEGRAM_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

參考：`.env.example`

## 目前可用的管理頁
- `/login`
- `/admin`
- `/admin/audit`
- `/admin/providers`
- `/admin/registry`
- `/admin/system`
- `/admin/telegram`

## Health endpoints
- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/targets`
- `GET /api/metrics`

## Testing artifacts
- Local aggregate runner: `npm run test:core`
- Local aggregate runner with raw logs: `npm run test:report:core`
- Raw outputs are stored in `reports/raw/`
- Current CI aggregate runner: `.github/workflows/test-core.yml`

## System restore safeguards
- 只允許還原 `SQLITE_BACKUP_DIR` 內的 `.sqlite` 檔案
- 還原前會先做 `PRAGMA integrity_check`
- 還原前會自動建立一份 pre-restore rollback backup
- 還原後再次做 SQLite integrity validation
- 可由 `/admin/system` 上傳 `.sqlite` 備份檔，再選擇是否立即還原

## Render SQLite notes
- Render 目前仍以 `npm run start` 啟動，`prestart` 會先執行 [`scripts/run_prisma_migrate_deploy.cjs`](/home/mimas/projects/mytelebot/scripts/run_prisma_migrate_deploy.cjs)
- 這個包裝腳本會處理 SQLite 舊資料庫沒有 `_prisma_migrations` 的 baseline 情境
- 也會清理「只有 runtime-only tables 卻被誤寫 baseline」的假 migration 歷史狀態
- Render 免費版 demo 若使用 `/tmp/data/...`，請假設 SQLite 與 backups 在 restart / redeploy 後都會被清空

## 目前 webhook 行為
`POST /api/telegram/webhook`
- 驗證 `x-telegram-bot-api-secret-token`
- 驗證 Telegram allowlist
- 呼叫 active provider 做結構化解析
- 命中 registry 白名單後 dispatch 到 target API
- 將結果回覆 Telegram 並寫入 audit log
- 錯誤會區分為 provider、parse、validation、dispatch network、dispatch HTTP
- API 回傳會固定帶 `stage`, `intent`, `parsed`, `validated`, `dispatched`, `status`
- API 與 Telegram reply 會共用同一組 `reasonCode`
- Telegram reply 會附上摘要與 operator hint
- 重複的 `update_id` 會被標記為 `duplicate_update_ignored`

回傳欄位重點：
- `stage`: `authorization | provider | parse | validation | dispatch`
- `validated`: 是否通過 registry 白名單與參數驗證
- `dispatched`: 是否真的送到 target 並成功
- `reasonCode`: 提供給 webhook JSON 與 Telegram reply 共用的原因碼
- `validationReason`: 驗證失敗時的內部原因碼

回傳範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success",
  "targetKey": "espmiao",
  "deviceKey": "light_01",
  "commandKey": "lightcommands",
  "args": {
    "state": "ON"
  },
  "dispatch": {
    "ok": true,
    "status": 200,
    "errorType": null,
    "errorMessage": null
  }
}
```

```json
{
  "ok": true,
  "authorized": true,
  "stage": "validation",
  "intent": "device_control",
  "parsed": true,
  "validated": false,
  "dispatched": false,
  "status": "validation_failed",
  "reasonCode": "device_not_found",
  "message": "找不到指定的裝置。",
  "validationReason": "device_not_found"
}
```

目前安全策略：
- 不使用單一 target/device/command 自動套用 fallback
- 原始文字必須明確提到 `deviceKey`、`name` 或 `alias`
- alias 必須由管理者顯式加入白名單
- command alias 只會幫助命中既有 command，不會放寬 device 白名單

## 已知限制
- command args 驗證已支援 `required/type/enum/minimum/maximum/pattern/nested object`
- audit log UI 目前為第一版，只支援基本篩選與明細檢視
- SQLite restore 為單實例流程，仍不適合多副本部署
- 目前以單實例 SQLite 為主，尚未切到 PostgreSQL
