# SQLite To PostgreSQL Migration Path

## 1. Goal
- Move the prototype from single-instance SQLite to managed PostgreSQL without breaking:
  - admin login
  - provider / target / device registry
  - Telegram allowlist
  - audit logs
  - pending confirmations
  - command cooldown history

## 2. When To Migrate
SQLite 應在以下情況前遷移：
- 準備啟用多 instance 部署
- webhook 流量與 audit log 開始持續增長
- 需要更安全的備份、回滾與 managed DB 運維能力
- 需要 serverless 或多區域部署

## 3. Current Assumptions To Remove
目前系統仍有這些 SQLite 假設：
- DB 是單一檔案
- backup / restore 依賴檔案複製
- Render Persistent Disk 是主要狀態儲存
- 單 instance 避免資料競爭

遷移到 PostgreSQL 後，這些要改成：
- DB 由 managed Postgres 提供
- backup / restore 交給資料庫平台或 SQL dump 流程
- app instances 可水平擴充
- health 與 metrics 改為檢查資料庫連線，而不是檔案狀態

## 4. Recommended Rollout

### Phase 1: Prepare Schema Compatibility
- 把 `DATABASE_URL` 改成 PostgreSQL connection string
- 更新 Prisma datasource provider 為 `postgresql`
- 檢查欄位型別：
  - `String @id @default(cuid())` 可沿用
  - JSON 文字欄位可先保留 `String`，不必第一步就改成 `Json`
  - `DateTime` 可直接沿用

### Phase 2: Provision PostgreSQL
- 建立 managed PostgreSQL instance
- 設定：
  - `DATABASE_URL`
  - 若平台要求，也補：
    - `DIRECT_URL`
    - SSL 相關參數
- 在 staging 先跑：
  - `prisma migrate deploy`
  - `npm exec -- prisma generate`

### Phase 3: Export SQLite Data
建議先做 application freeze，避免匯出期間資料變動。

最低要匯出的表：
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

建議方式：
1. 建立一份最終 SQLite backup
2. 用腳本讀出 SQLite 表資料
3. 依相依順序匯入 PostgreSQL

匯入順序建議：
1. `User`
2. `Secret`
3. `LlmProvider`
4. `Target`
5. `Device`
6. `DeviceCommand`
7. `TelegramAccount`
8. `TelegramUpdate`
9. `PendingTelegramAction`
10. `CommandExecution`
11. `AuditLog`

## 5. Practical Data Migration Strategy
對目前專案，最務實的方式是寫一次性 Node script：
- 讀 SQLite
- 轉成 JSON batches
- 用 Prisma 寫入 PostgreSQL

原因：
- 目前 schema 不大
- 大多數欄位都是 scalar
- 比直接手寫 SQL dump / import 更容易控制關聯順序

## 6. Cutover Checklist
- staging 上完整跑一次 migration script
- 驗證：
  - `/login`
  - `/admin/providers`
  - `/admin/registry`
  - `/admin/telegram`
  - `/admin/audit`
  - `/api/health`
  - `/api/metrics`
  - `npm run test:integration:webhook`
- 確認 active provider、target、allowlist 都存在
- 確認 audit logs 可查
- 確認 confirmation / cooldown 相關資料保留

正式切換步驟：
1. 暫停 webhook 寫入或進入 maintenance window
2. 建立最後一份 SQLite backup
3. 執行資料匯出與 PostgreSQL 匯入
4. 切換 `DATABASE_URL`
5. 重新部署 app
6. 執行 smoke tests
7. 設定 Telegram webhook 指向最新服務

## 7. Backup Strategy After Migration
遷移後不應再依賴 `/admin/system` 的 SQLite backup / restore 模型。

應改為：
- 使用 PostgreSQL 平台內建 backup
- 或定期 `pg_dump`
- restore 流程改為：
  - staging 驗證
  - DB-level restore
  - app reconnect / deployment recycle

## 8. Code Areas To Revisit After Migration
- `apps/web/lib/system.js`
  - SQLite file path / backup / restore 邏輯應降級為 legacy-only
- `docs/render-deployment-env.md`
  - Persistent Disk 不再是 DB 必要條件
- `/admin/system`
  - 改顯示 PostgreSQL operational status，而不是 SQLite 檔案操作
- health / metrics 文件
  - 補 PostgreSQL-specific 指標

## 9. Risks
- SQLite 匯出時若仍有寫入，可能造成最後資料不一致
- secret / FK 匯入順序錯誤會導致 provider / target 關聯失敗
- Telegram dedupe / pending action 若遺漏，會影響 webhook 行為
- 若直接在 production 首次切換，問題會很難回滾

## 10. Recommended Next Engineering Step
當你真的要切 PostgreSQL 前，建議先做兩件事：
1. 加一個一次性 migration script，從 SQLite 輸出 JSON fixtures
2. 在 staging 建一套 Postgres 環境，先完整演練一次 cutover
