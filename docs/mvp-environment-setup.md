# MVP 環境初始化清單

## 1. 目標
這份文件定義第一版原型的環境基線，目標是用最少基礎設施做出可部署、可登入、可接 Telegram、可管理模型與設備設定的版本。

本階段固定條件：
- 部署平台：`Render`
- Runtime：`Node.js $NODE_VERSION`
- 應用型態：單一 `Next.js` web service
- 資料庫：`SQLite`
- 儲存：`Render Persistent Disk`

## 2. 本機環境基線

### 必備工具
- `nvm`
- `Node.js $NODE_VERSION`
- `npm`
- `git`

### 建議固定版本方式
因你目前使用 `nvm` 管理 Node，建議專案內固定：

```bash
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
```

後續可在專案加入：
- `.nvmrc`
- `.node-version`

內容都固定為：

```text
${NODE_VERSION}
```

## 3. 原型第一階段要先完成的底座

### 階段 A：專案骨架
- 初始化 `Next.js`
- 初始化 `npm workspaces`
- 補 `Prisma`
- 建立 SQLite database 路徑
- 建立 `data/` 與 `data/backups/` 目錄規劃

### 階段 B：登入與管理底座
- 建立 admin login 頁
- 啟動時用 `.env` 的 `ADMIN_USER`、`ADMIN_PASSWORD` bootstrap 第一個管理者
- DB 僅存 password hash，不存明碼
- 建立 session 機制與受保護 admin routes

### 階段 C：設定資料管理
- LLM provider CRUD
- target server CRUD
- device / command CRUD
- secrets 加密存放

### 階段 D：Bot 主流程
- Telegram webhook endpoint
- allowlist 驗證
- LLM 結構化輸出
- dispatcher 執行設備命令
- audit log
- webhook JSON 測試回應
- mock target device server

### 階段 E：SQLite 管理能力
- DB 備份匯出 API
- DB 上傳回復 API
- 回復前驗證 admin session
- 回復後做服務重載或連線重建

## 4. Render-first 服務樣態

### 第一版只開一個服務
- `Web Service`: Next.js server
- `Persistent Disk`: 保存 SQLite 與 backups

### 不要在第一版做的事
- 多 instance
- polling bot
- queue worker
- PostgreSQL 遷移
- 多管理員流程

## 5. 資料路徑建議

本機開發可先這樣規劃：

```text
data/
  mytelebot.sqlite
  backups/
```

Render 部署時建議對應：

```text
/var/data/mytelebot.sqlite
/var/data/backups/
```

## 6. 環境變數最小集合

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

## 7. 原型期的重要限制
- SQLite 僅適合單機單副本
- 不能將 DB 檔案放在 ephemeral filesystem
- 備份 API 必須有額外驗證與操作審計
- 不應允許前端直接下載明文 secrets
- 不應讓 LLM 自由產生目標 URL

## 8. 建議的第一個里程碑
完成以下項目就算原型底座建好：
- 專案可在本機啟動
- admin 可登入
- SQLite 可寫入 `users`、`llm_providers`、`targets`
- Render 可部署成功
- Telegram webhook endpoint 可被打到

目前已達成：
- 本機 mock target 可接受 dispatcher 請求
- webhook 可回傳 stage / validation / dispatch 狀態
- device alias 可用於自然語言命中
- command alias 可用於穩定命中既有 command
- provider 可在後台直接更新 base URL、model、headers、capabilities 與 API key
- provider capability profile 與 JSON strictness 可由後台設定
- provider API key 可由後台獨立 rotation，保留 secret 歷史
- SQLite backup / restore 可由後台操作，restore 會自動建立 rollback backup
- Telegram allowlist 可直接綁定到既有 admin user
- webhook 錯誤分類與 Telegram operator hints 已落地
- `/admin/system` 與 `/api/metrics` 已提供營運指標與近期事件摘要
- 已補充 SQLite -> PostgreSQL migration path 文件
- 已建立 `docs/testing-standard.md` 與 `npm run smoke:webhook`
- 已建立 `npm run test:integration:webhook`
