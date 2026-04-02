# 新手開始說明書

這份文件假設你是第一次接觸這個專案，也可能是第一次接觸：
- `Node.js`
- `Render`
- `Telegram Bot`
- `SQLite`
- `.env` 環境變數

目標不是一次把所有概念講深，而是讓你先把專案安全地跑起來、看得見、測得到。

## 1. 你現在要做的是什麼
你要先完成四件事：
1. 在自己電腦上把專案跑起來
2. 用本機測試腳本確認功能真的正常
3. 看懂哪些是部署前一定要準備的資料
4. 之後再去 `Render` 做第一次雲端部署

如果你還沒做過雲端部署，請先不要急著碰 `Render`。先把本機跑通，後面會輕鬆很多。

## 2. 你需要先安裝哪些東西

### 必備工具
- `git`
- `nvm`
- `Node.js $NODE_VERSION`
- `npm`
- `python3`

### 檢查方式
在終端機輸入：

```bash
git --version
python3 --version
nvm --version
```

如果 `nvm` 還沒安裝，先去安裝 `nvm`，再安裝 Node：

```bash
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
```

## 3. 先把專案抓下來
如果你還沒有這個專案：

```bash
git clone <你的專案網址> mytelebot
cd mytelebot
```

如果你已經有專案資料夾，就直接進去：

```bash
cd ~/projects/mytelebot
```

## 4. 安裝套件

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_VERSION"
npm install
npm exec -- prisma generate
```

做完後，代表 JavaScript 套件與 Prisma client 已經準備好。

## 5. 準備 `.env`
專案需要一份 `.env`。
如果你還沒有，可以參考 `.env.example` 自己建立。

最小可用內容至少要有：

```bash
NODE_ENV=$NODE_ENV
APP_URL=$APP_URL
DATABASE_URL=$DATABASE_URL
SQLITE_FILE_PATH=$SQLITE_FILE_PATH
SQLITE_BACKUP_DIR=$SQLITE_BACKUP_DIR

ADMIN_USER=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=change-this-session-secret
APP_ENCRYPTION_KEY=change-this-32-byte-key

TELEGRAM_TOKEN=replace-with-your-bot-token
TELEGRAM_WEBHOOK_SECRET=replace-with-random-secret
```

## 6. 啟動本機網站

```bash
npm run dev
```

成功後，瀏覽器打開：

```text
$APP_URL
```

你至少應該能看到：
- `/login`
- `/admin`
- `/admin/providers`
- `/admin/registry`
- `/admin/system`
- `/admin/telegram`

## 7. 第一次登入
用 `.env` 裡的這組登入：
- `ADMIN_USER`
- `ADMIN_PASSWORD`

登入成功後，你就能進管理後台。

## 8. 你要先建立哪些資料
想讓 bot 可以控制設備，至少要有三層資料：
1. Provider
2. Target
3. Device / Command

### Provider
這是 LLM 供應商，例如：
- OpenAI-compatible API
- 本機 Ollama gateway
- 其他相容 `/chat/completions` 的服務

如果你現在想直接接 Google Gemini，可先看：

- [google-gemini-provider-setup.md](./google-gemini-provider-setup.md)

### Target
這是設備 API 的目標伺服器。
例如：
- `http://127.0.0.1:8000`
- 你家裡的 home gateway

### Device / Command
這是白名單控制規則。
例如：
- device: `light_01`
- command: `lightcommands`
- payload template: `{"state":"{{state}}"}`

## 9. 新手最容易卡住的地方

### 卡住 1：沒有可測的設備
如果你還沒有真的設備 API，可以先用 mock device：

```bash
npm run mock:device
```

### 卡住 2：沒有可測的 LLM
如果你不想先接真的雲端模型，可以用 mock LLM：

```bash
npm run mock:llm
```

### 卡住 3：沒有 Telegram 真的 outbound
如果你現在只想測 bot 回覆訊息鏈路，不想真的打到 Telegram Cloud：

```bash
npm run mock:telegram
```

## 10. 本機測試你應該先跑哪些

### 最小測試

```bash
npm run test:core
npm run build
```

### 完整訊息鍊路測試

```bash
npm run test:integration:message-flow
```

### 若要同時留下 raw data

```bash
REPORT_DATE=20260401 npm run test:report:core
REPORT_DATE=20260401 npm run test:report:message-flow
```

raw logs 會放在：
- `reports/raw/`

報告會放在：
- `reports/TEST-[YYYYMMDD].md`

## 11. 什麼時候才應該開始碰 Render
只有當下面都完成後，才建議開始部署：
- 本機網站可啟動
- 可以登入後台
- provider / target / device / command 資料可正常建立
- `npm run test:core` 通過
- `npm run test:integration:message-flow` 通過
- `npm run build` 通過

如果上面任何一項沒過，先不要急著上雲。

## 12. Render 是什麼
`Render` 是一個雲端平台，你可以把網站放上去，讓 Telegram 或外部使用者透過網路連到你的程式。

你在本機跑 `localhost:3000` 時，只有你自己電腦看得到。
你部署到 `Render` 後，會得到一個像這樣的網址：

```text
https://your-app.onrender.com
```

Telegram webhook 之後就是打這個公開網址，不會再打你的 `localhost`。

## 13. Vercel 呢？
這個專案目前第一版比較建議用 `Render`，原因是：
- 你現在主資料庫是 `SQLite`
- 需要 Persistent Disk
- 需要比較穩定的 Node server 行為

`Vercel` 不是不能用，但不適合這個專案的第一版原型。

## 14. 部署前你接下來應該讀哪份文件
本文件看完後，下一份請直接看：
- `docs/deployment-checklist-beginner.md`

那份文件會一步一步檢查：
- 哪些資料要先準備
- 哪些按鈕要在哪裡按
- 哪些地方最常出錯
- 部署後怎麼驗證
