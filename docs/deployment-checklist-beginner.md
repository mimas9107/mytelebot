# 新手部署前 Checklist

這份 checklist 是給完全沒碰過 `Render`、`Vercel`、`Telegram webhook` 的人用的。

目的很單純：
在你按下部署前，先逐條確認，避免把「其實本機都還沒穩」的東西直接丟到雲端。

你不需要一次理解所有名詞，只要照順序一條一條檢查。

## 1. 先確認你現在要部署去哪裡
第一版請優先用：
- `Render`

第一版先不要用：
- `Vercel`

原因：
- 目前主資料庫是 `SQLite`
- 若你使用付費版，可搭配 `Persistent Disk`
- 若你使用免費版，只適合 demo，不適合持久化資料
- `Render` 比較符合這個原型的運作方式

## 2. 本機條件檢查
在碰雲端之前，下面必須全部成立。

### 2.1 專案可以啟動
你要能成功執行：

```bash
npm run dev
```

並且瀏覽器能打開：
- `$APP_URL/login`
- `$APP_URL/admin`

### 2.2 後台可以登入
你要能用 `.env` 裡的：
- `ADMIN_USER`
- `ADMIN_PASSWORD`

成功登入。

### 2.3 Provider / Target / Device / Command 都能建立
至少要確認後台這幾塊都可以操作：
- `/admin/providers`
- `/admin/registry`
- `/admin/system`
- `/admin/telegram`

### 2.4 自動化測試全部通過
你至少要跑：

```bash
npm run test:core
npm run test:integration:message-flow
npm run build
```

如果你要保存證據，請跑：

```bash
REPORT_DATE=20260401 npm run test:report:core
REPORT_DATE=20260401 npm run test:report:message-flow
```

### 2.5 確認 raw data 與報告都有留下
你應該要看得到：
- `reports/raw/TEST-20260401-test-core.log`
- `reports/raw/TEST-20260401-build.log`
- `reports/raw/TEST-20260401-message-flow.log`
- `reports/TEST-20260401.md`

如果你沒有 raw data，不建議直接進部署階段。

## 3. 你的 Telegram Bot 資料有沒有先準備好
部署前，你至少要有這兩個：
- `TELEGRAM_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

### 3.1 `TELEGRAM_TOKEN` 是什麼
這是你從 `BotFather` 拿到的 bot token。

### 3.2 `TELEGRAM_WEBHOOK_SECRET` 是什麼
這是你自己設定的一段隨機字串，用來保護 webhook 請求。

例如：

```text
$TELEGRAM_WEBHOOK_SECRET
```

### 3.3 目前本機測試代表什麼
目前本機已經測過：
- webhook 入口
- validation
- confirmation
- cooldown
- Telegram outbound reply chain

但還沒測過：
- 真正 Telegram Cloud 打到你的 Render 網址

所以部署後還是要再做一次真實 webhook 驗證。

## 4. Render 帳號與服務設定準備

### 4.1 你要先有 Render 帳號
如果還沒有，先註冊 `Render`。

### 4.2 你要準備一個 Web Service
建立時選：
- Environment: `Node`

### 4.3 Build / Start 指令
填這兩個：

```text
Build Command: npm install && npm run build
Start Command: npm run start
```

補充：
- repo 目前會在 build 前自動執行 `prisma generate`
- repo 目前會在 start 前自動執行 `prisma migrate deploy`
- 第一次使用新的 Render Persistent Disk 時，資料表會在 service 啟動前建立

### 4.4 Region
選離你使用地最近的區域。

### 4.5 Instance
第一版先用單一 instance。
不要開多 instance，因為：
- 目前是 `SQLite`
- 不適合多副本共用

### 4.6 免費版或付費版先選清楚
- 若你是 Render 付費版：使用 `Persistent Disk`，路徑用 `/var/data/...`
- 若你是 Render 免費版：沒有 `Persistent Disk`，只能當 demo 環境
- 免費版請使用絕對 SQLite 路徑，例如 `/opt/render/project/src/data/mytelebot.sqlite`
- 免費版不要使用 `file:./data/mytelebot.sqlite`，因為 build / migrate / runtime 的工作目錄可能不同

## 5. Persistent Disk 檢查
這是新手最容易漏掉、也最容易導致資料消失的地方。

### 5.1 付費版一定要掛 Persistent Disk
如果你要保留資料，就一定要掛 disk。
如果沒掛 disk，你的 SQLite 可能在重啟或重新部署後消失。

如果你是免費版：
- 這一節不能照做，因為沒有 disk 可掛
- 你必須接受資料不保留

### 5.2 掛載路徑
建議：

```text
/var/data
```

### 5.3 你要讓這些路徑一致

```bash
DATABASE_URL=file:/var/data/mytelebot.sqlite
SQLITE_FILE_PATH=/var/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/var/data/backups
```

### 5.4 不要做的事
不要把 SQLite 放在：
- 專案原始碼目錄的暫時檔區
- 沒有掛 disk 的路徑
- Render 免費版的相對路徑，例如 `file:./data/mytelebot.sqlite`

## 6. Render 環境變數 Checklist
如果你是 Render 付費版，部署前至少檢查下面都有填：

```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=production
APP_URL=https://your-render-domain.onrender.com
RENDER_EXTERNAL_URL=https://your-render-domain.onrender.com

DATABASE_URL=file:/var/data/mytelebot.sqlite
SQLITE_FILE_PATH=/var/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/var/data/backups

ADMIN_USER=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
APP_ENCRYPTION_KEY=...

TELEGRAM_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

如果你是 Render 免費版 demo，請改成：

```bash
NODE_VERSION=$NODE_VERSION
NODE_ENV=production
APP_URL=https://your-render-domain.onrender.com
RENDER_EXTERNAL_URL=https://your-render-domain.onrender.com

DATABASE_URL=file:/opt/render/project/src/data/mytelebot.sqlite
SQLITE_FILE_PATH=/opt/render/project/src/data/mytelebot.sqlite
SQLITE_BACKUP_DIR=/opt/render/project/src/data/backups

ADMIN_USER=...
ADMIN_PASSWORD=...
SESSION_SECRET=...
APP_ENCRYPTION_KEY=...

TELEGRAM_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

### 新手最常犯錯
- `APP_URL` 還留 `localhost`
- `DATABASE_URL` 還指向本機路徑
- 在免費版使用相對 SQLite 路徑
- 忘了 `SESSION_SECRET`
- 忘了 `APP_ENCRYPTION_KEY`
- `TELEGRAM_WEBHOOK_SECRET` 本機跟雲端不一致

## 7. 部署前功能條件 Checklist
請逐條確認。

### 7.1 Provider
- 至少有一個 active provider
- `Test connection` 成功
- model / base URL 正確

### 7.2 Target
- 至少有一個 target
- `Test connection` 成功
- target auth 設定正確

### 7.3 Device / Command
- 至少一個可控制設備存在
- command payload template 已驗證
- alias 已設定好
- 如果 command 很敏感，已打開 `confirmationRequired`

### 7.4 Telegram allowlist
- 你的 Telegram user id 已加入 allowlist
- 如有需要，已連到對應 admin user

## 8. 部署後第一輪檢查
當 Render 顯示部署成功後，不要立刻測 Telegram。先做下面這些。

### 8.1 開網站首頁與登入頁
確認這些網址打得開：
- `https://your-render-domain.onrender.com/`
- `https://your-render-domain.onrender.com/login`

### 8.2 檢查 health endpoints
直接打：
- `/api/health`
- `/api/health/db`

### 8.3 如果 Render logs 太安靜
目前專案已經支援一個「不用重啟、不用 redeploy」的 runtime logging 開關。

位置：

- `/admin/system`
- 區塊名稱：`Runtime logging`

用途：

- 開啟後，server 會輸出較完整的 `info` 級 JSON logs
- 包含 webhook 收到、LLM request、validation、dispatch、health check 等流程
- 關閉後，會停止大部分 `info` logs，避免 Render logs 被洗版
- `warn` 與 `error` 不會被關掉，所以真正的錯誤仍會保留

什麼時候應該打開：

- 你懷疑 Render service 有 silent restart
- Telegram webhook 看起來沒反應
- Provider / Target 看起來有打到，但不知道卡在哪一段
- 你想在 Render logs 用同一個 `traceId` 串一整筆 webhook 流程

建議做法：

1. 先到 `/admin/system` 開啟 `Runtime logging`
2. 重跑一次同樣的操作
3. 再去看 Render logs
4. 問題排完後可再關掉，避免 logs 太多
- `/api/health/targets`
- `/api/metrics`

預期：
- 不應 500
- DB health 應成功
- target summary 至少可回 JSON

### 8.3 進後台看 system 頁
看：
- `/admin/system`

確認：
- metrics 有出來
- recent events 有出來

### 8.4 檢查 SQLite 實際落點
你要確認應用真的在用你設定的絕對路徑。

付費版預期：
- `/var/data/mytelebot.sqlite`

免費版 demo 預期：
- `/opt/render/project/src/data/mytelebot.sqlite`

## 9. Telegram webhook 掛接 Checklist
這是部署後最關鍵的一步。

### 9.1 你的 webhook URL 應該是

```text
https://your-render-domain.onrender.com/api/telegram/webhook
```

### 9.2 設定 webhook
把 `<TOKEN>` 換成你的 bot token，把 `<SECRET>` 換成 `TELEGRAM_WEBHOOK_SECRET`：

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://your-render-domain.onrender.com/api/telegram/webhook",
    "secret_token": "<SECRET>"
  }'
```

### 9.3 檢查 webhook 是否真的掛上

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

你要確認：
- URL 是對的
- 沒有 last_error_message

## 10. 真機測試 Checklist
現在才開始用手機 Telegram 測。

### 10.1 基本訊息
先送：
- 一條安全可控的命令

例如：
- `把燈打開`

### 10.2 confirmation 命令
如果該 command 設了 `confirmationRequired`：
- bot 應回 token
- 你再送 `confirm TOKEN`
- 或送 `cancel TOKEN`

### 10.3 去看 audit
進：
- `/admin/audit`

確認：
- 有 `received`
- 有 `parsed_valid` 或 `validation_failed`
- 有 `dispatch_success` 或對應失敗狀態

### 10.4 去看 system events
進：
- `/admin/system`

確認：
- event summary 有記錄到 webhook / dispatch 類事件

## 11. 部署後如果失敗，先看哪裡
新手常常不知道先看哪裡。順序如下。

### 第一層：health
先看：
- `/api/health`
- `/api/health/db`

### 第二層：後台連線測試
再看：
- provider `Test connection`
- target `Test connection`

### 第三層：audit
再看：
- `/admin/audit`

### 第四層：Telegram webhook info
再看：
- `getWebhookInfo`

### 第五層：Render logs
最後再看 Render service logs。

## 12. 現在還不能假設安全無虞的地方
即使本地測試都過了，部署前你仍要記住：
- 真正家庭內網設備是否可被 Render 打到，還沒保證
- 真正 Telegram Cloud 與 Render 的網路穩定性，還沒保證
- SQLite 只適合單 instance

## 13. 什麼情況下先不要上線
如果有任何一條成立，先不要正式上線：
- `npm run build` 沒過
- `npm run test:integration:message-flow` 沒過
- 沒有 raw data 與測試報告
- Render health endpoint 500
- `getWebhookInfo` 顯示 webhook 有錯
- provider / target test connection 失敗
- 你還不知道 SQLite 是否真的放在 Persistent Disk

## 14. 你部署前最後要再讀哪份文件
- `docs/render-deployment-env.md`
- `docs/testing-standard.md`

這兩份會補充：
- 環境變數細節
- 測試規範
- raw data 與報告要求
