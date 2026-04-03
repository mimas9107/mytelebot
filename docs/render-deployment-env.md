# Render 部署需求與環境變數

## 1. 部署模式
目前支援兩種 Render 部署模式：

### A. Render 付費版正式模式
- `Render Web Service`
- `Persistent Disk`
- `Next.js` server mode
- `SQLite` 作為主資料庫

適用情境：
- 你要保留資料
- 你要讓 redeploy / restart 後資料仍存在
- 你願意使用 Render 付費 instance

### B. Render 免費版 demo 模式
- `Render Web Service`
- 無 `Persistent Disk`
- `Next.js` server mode
- `SQLite` 作為暫時性資料庫

適用情境：
- 你只想先驗證登入、後台頁面與 webhook 流程
- 你接受 redeploy / restart / instance 重建後資料消失

限制：
- 不保證資料持久化
- 不適合正式環境
- `backup/restore` 僅有流程驗證意義，不具真正持久化保證

## 2. Render 服務設定建議

### Web Service
- Environment: `Node`
- Region: 依你的主要使用地選最近區域
- Build Command: `npm install && npm run build`
- Repo 內建置腳本已包含 `prisma generate`，不需要另外在 Render 手動追加
- Start Command: `npm run start`
- Repo 啟動腳本已包含 Prisma migration deploy 包裝器
- 第一次啟動空白 SQLite 檔案時，會自動建立資料表
- 若 SQLite 檔案已存在資料表、但缺少 `_prisma_migrations` 歷史表，啟動腳本會先做一次 baseline，再繼續 `migrate deploy`

### 付費版 Persistent Disk
- 掛載路徑建議：`/var/data`
- SQLite 路徑：`/var/data/mytelebot.sqlite`
- 備份目錄：`/var/data/backups`

### 免費版 demo 路徑
- 建議使用絕對路徑
- 建議 SQLite 路徑：`/tmp/data/mytelebot.sqlite`
- 建議備份目錄：`/tmp/data/backups`

注意：
- 不要使用 `file:./data/mytelebot.sqlite`
- 原因是 `prisma migrate deploy` 與 `next start` 的工作目錄不同，相對路徑可能指到不同檔案
- Render 免費版若把 SQLite 放在 `/opt/render/project/src/...`，可能殘留舊 deploy 建出的資料檔
- 這類舊 SQLite 若已有資料表、但沒有 `_prisma_migrations`，後續 deploy 很容易撞到 Prisma baseline / migrate 問題
- `/tmp/...` 在免費版 demo 比較適合作為「每次啟動都從乾淨狀態開始」的暫時路徑
- 但 `/tmp/...` 只適合 demo：service restart、redeploy、instance 重建後，資料都可能被清空

補充：
- 如果你是從較早期版本升上來，SQLite 可能已經有資料表，但當時還沒有 Prisma migration history
- 這種情況在 Render start 階段常見錯誤是 `P3005 The database schema is not empty`
- repo 目前已內建 baseline 保護腳本，會在偵測到「非空 SQLite + 無 `_prisma_migrations`」時，直接快速建立 Prisma migration history，再繼續部署

## 3. 環境變數建議

### 付費版必填
```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=production
APP_URL=https://your-render-domain.onrender.com
RENDER_EXTERNAL_URL=https://your-render-domain.onrender.com

DATABASE_URL=file:/var/data/mytelebot.sqlite
SQLITE_FILE_PATH=/var/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/var/data/backups

ADMIN_USER=
ADMIN_PASSWORD=

SESSION_SECRET=
APP_ENCRYPTION_KEY=

TELEGRAM_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

HOME_GATEWAY_SHARED_SECRET=
```

### 免費版 demo 必填
```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=production
APP_URL=https://your-render-domain.onrender.com
RENDER_EXTERNAL_URL=https://your-render-domain.onrender.com

DATABASE_URL=file:/tmp/data/mytelebot.sqlite
SQLITE_FILE_PATH=/tmp/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/tmp/data/backups

ADMIN_USER=
ADMIN_PASSWORD=

SESSION_SECRET=
APP_ENCRYPTION_KEY=

TELEGRAM_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

HOME_GATEWAY_SHARED_SECRET=
```

重點提醒：
- 這組 `/tmp/...` 設定的意思是「暫時可用、方便部署」
- 不代表資料會保留
- 只要 Render service restart / redeploy / rebuild / instance replacement，就要假設資料可能被清空

### 保留但不建議作為 SQLite 本體帳密
若你一定要保留這兩個欄位，建議改為備份 API 用途，而非 SQLite 本體：

```bash
SQLITE_USER=
SQLITE_PASSWORD=
```

建議重新命名為：

```bash
SQLITE_BACKUP_USER=
SQLITE_BACKUP_PASSWORD=
```

## 4. `.env.example` 建議內容

```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=$NODE_ENV

APP_URL=$APP_URL
RENDER_EXTERNAL_URL=

DATABASE_URL=$DATABASE_URL
SQLITE_FILE_PATH=$SQLITE_FILE_PATH
SQLITE_BACKUP_DIR=$SQLITE_BACKUP_DIR

ADMIN_USER=
ADMIN_PASSWORD=

SESSION_SECRET=
APP_ENCRYPTION_KEY=

TELEGRAM_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

HOME_GATEWAY_SHARED_SECRET=

SQLITE_BACKUP_USER=
SQLITE_BACKUP_PASSWORD=
```

## 5. SQLite 備份與回復策略

### MVP 要有的能力
- `POST /api/admin/system/backup`
- `POST /api/admin/system/restore`
- `GET /api/admin/system/backups`

目前實作狀態：
- webhook、provider registry、device registry、telegram allowlist、audit UI 已落地
- telegram allowlist 與 admin user link 已落地
- provider edit、command alias、command edit 已落地
- provider API key rotation 與 secret history 已落地
- webhook reason taxonomy 與 operator hints 已落地
- structured operational metrics 與 system event summary 已落地
- provider capability profile 與 JSON strictness 已落地
- backup create / list / restore 已落地
- health endpoints 與本機 webhook integration test tooling 已落地

### 備份建議行為
- 先驗證 admin session
- 將目前 SQLite 複製成帶時間戳的檔案
- 存到 `SQLITE_BACKUP_DIR`
- 寫入 audit log

備份檔名建議：

```text
mytelebot-20260331-103000.sqlite
```

### 回復目前行為
- 先驗證 admin session
- 僅允許 `SQLITE_BACKUP_DIR` 內的 `.sqlite` 備份檔
- 對來源備份執行 `PRAGMA integrity_check`
- 先備份目前 DB，再覆蓋
- 覆蓋後再次做 SQLite integrity validation
- 寫入 audit log

## 6. 需要避免的做法
- 把 SQLite 放在非 Persistent Disk 路徑
- 在 Render 免費版使用相對 SQLite 路徑
- 用多個 Render instances 共用同一個 SQLite
- 將 `ADMIN_PASSWORD` 當成長期唯一登入真相而不寫入 DB
- 讓未登入使用者可下載 DB 備份
- 依賴寬鬆 fallback 自動猜測 target/device/command

## 7. 後續遷移到 PostgreSQL
- 遷移路徑、cutover checklist 與風險說明請參考：
  - `docs/sqlite-to-postgres-migration.md`
