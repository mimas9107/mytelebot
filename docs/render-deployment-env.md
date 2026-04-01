# Render 部署需求與環境變數

## 1. 部署模式
第一版採：
- `Render Web Service`
- `Persistent Disk`
- `Next.js` server mode
- `SQLite` 作為主資料庫

## 2. Render 服務設定建議

### Web Service
- Environment: `Node`
- Region: 依你的主要使用地選最近區域
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

### Persistent Disk
- 掛載路徑建議：`/var/data`
- SQLite 路徑：`/var/data/mytelebot.sqlite`
- 備份目錄：`/var/data/backups`

## 3. 環境變數建議

### 必填
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
- 用多個 Render instances 共用同一個 SQLite
- 將 `ADMIN_PASSWORD` 當成長期唯一登入真相而不寫入 DB
- 讓未登入使用者可下載 DB 備份
- 依賴寬鬆 fallback 自動猜測 target/device/command

## 7. 後續遷移到 PostgreSQL
- 遷移路徑、cutover checklist 與風險說明請參考：
  - `docs/sqlite-to-postgres-migration.md`
