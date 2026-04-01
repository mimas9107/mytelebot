# Testing Standard

## 1. 目的
- 建立一致的本機測試流程，避免把一次性的手動驗證遺漏在口頭描述中。
- 所有重要測試結果都必須回寫到 `reports/TEST-[YYYYMMDD].md`。

## 2. 前置檢查
- 確認 Node 版本固定為 `$NODE_VERSION`
- 確認 Prisma Client 已生成
- 確認 `.env` 內至少包含：
  - `DATABASE_URL`
  - `ADMIN_USER`
  - `ADMIN_PASSWORD`
  - `SESSION_SECRET`
  - `APP_ENCRYPTION_KEY`
  - `TELEGRAM_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`

建議指令：

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_VERSION"
npm exec -- prisma generate
```

## 3. 基本測試層級

### 3.1 語法與建置
每次修改 server flow、Prisma schema、admin UI 後，至少執行：

```bash
npm run build
```

若有 Python 輔助工具，額外執行：

```bash
python3 -m py_compile scripts/mock_device_server.py scripts/mock_llm_server.py scripts/test_webhook_integration.py
```

### 3.2 管理後台
若修改 admin 表單或 server action，至少確認：
- `/login`
- `/admin`
- 對應功能頁面可開啟
- 新增或更新操作成功後畫面可重新載入

若修改 system / metrics 相關功能，額外確認：
- `/admin/system`
- `/api/health`
- `/api/metrics`

### 3.3 Webhook 流程
若修改 Telegram webhook、registry 驗證、LLM parse、dispatcher，至少驗證：
- allowlist 外帳號會被拒絕
- allowlist 內帳號可進入 parse flow
- validation failure 會回一致的 `status`
- dispatch success 會回一致的 `status`
- 相同 `update_id` 會被 dedupe

建議使用：

```bash
npm run smoke:webhook -- "把light_01打開"
```

若要驗證 dedupe：

```bash
UPDATE_ID=3001 npm run smoke:webhook -- "把light_01打開"
UPDATE_ID=3001 npm run smoke:webhook -- "把light_01打開"
```

若要跑整體 fixture integration test：

```bash
npm run test:integration:webhook
```

前提：
- 本機 `npm run dev` 已啟動
- `.env` 內 `TELEGRAM_WEBHOOK_SECRET` 可供測試腳本使用

若要跑完整訊息鍊路 integration test（含 confirmation / cancel / cooldown / DB side effects / mock Telegram outbound）：

```bash
npm run test:integration:message-flow
```

此腳本會自行啟動：
- 本機 Next.js app
- mock LLM server
- mock target device server
- mock Telegram outbound server

若要保留 raw data：

```bash
REPORT_DATE=20260401 npm run test:report:message-flow
```

### 3.4 Target / Dispatcher
若修改 target auth、payload template、dispatcher：
- 啟動 mock target server
- 若修改 provider JSON strictness 或 OpenAI-compatible 行為，額外啟動 mock LLM server
- 驗證 `/health`
- 驗證至少一筆成功 dispatch
- 驗證至少一筆失敗案例，例如錯誤 auth 或 target 不存在

建議指令：

```bash
MOCK_DEVICE_PORT=8000 \
MOCK_DEVICE_AUTH_TYPE=bearer \
MOCK_DEVICE_AUTH_SECRET='dev-secret' \
npm run mock:device
```

```bash
MOCK_LLM_PORT=11435 npm run mock:llm
```

```bash
MOCK_TELEGRAM_PORT=19000 npm run mock:telegram
```

### 3.5 單元 / 契約 / Fixture 測試矩陣
目前腳本規劃如下，腳本檔名必須與 TODO 對齊：
- `scripts/test_contract_payload_template.mjs`
  - 驗證 payload template 佔位符替換、巢狀結構、保留未解析 placeholder。
- `scripts/test_alias_fixtures.mjs`
  - 驗證裝置 alias、命令 alias、Unicode 正規化與明確命中規則。
- `scripts/test_unit_llm.mjs`
  - 驗證 capability parsing、endpoint 選擇、JSON extraction、prompt contract。
- `scripts/test_unit_registry.mjs`
  - 驗證 JSON schema 驗證器：required、enum、pattern、minimum、maximum、nested object、array items。
- `scripts/test_unit_dispatcher.mjs`
  - 驗證 payload render、JSON body parsing、HMAC signature。
- `scripts/test_unit_telegram.mjs`
  - 驗證 confirmation token parsing、webhook secret 驗證。

建議指令：

```bash
npm run test:contract:payload
npm run test:fixtures:alias
npm run test:unit:llm
npm run test:unit:registry
npm run test:unit:dispatcher
npm run test:unit:telegram
```

若要跑目前已落地的本地測試合集：

```bash
npm run test:core
```

若要同時輸出 raw data logs：

```bash
REPORT_DATE=20260401 npm run test:report:core
```

## 4. 測試紀錄格式
每次完成一輪可回歸驗證後，更新：

```text
reports/TEST-[YYYYMMDD].md
```

至少記錄：
- Scope
- Commands
- Result
- Environment Notes
- Conclusion
- 對應 raw data 檔案路徑

## 5. 最低接受標準
- 新增功能必須至少通過 `npm run build`
- 若功能涉及 webhook 或 dispatcher，必須至少有一筆實際 smoke 測試
- 若功能涉及 schema 變更，必須確認 migration 可套用且 Prisma Client 可生成
- 若功能尚未做完整自動化測試，README 或 TODO 必須明確標示限制

## 6. Raw Data 產物
- 本機 aggregate runner 會輸出：
  - `reports/raw/TEST-[YYYYMMDD]-test-core.log`
  - `reports/raw/TEST-[YYYYMMDD]-build.log`
- 每一份 `reports/TEST-[YYYYMMDD].md` 應引用本輪 raw data 檔案。
- 若後續新增 integration / smoke / manual 測試腳本，也應沿用 `reports/raw/` 命名慣例保存原始輸出。
