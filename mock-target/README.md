# MyTeleBot Mock Target

這是一個可獨立拆出的 Python 小專案，用來充當 MyTeleBot 的 `Target`。

用途：

- 接收 MyTeleBot dispatch 出來的 HTTP request
- 記錄 method / path / query / headers / body 長什麼樣
- 模擬成功、業務拒絕、HTTP error、timeout
- 協助你設計未來家中真正要暴露的 API

這個子專案刻意採用最傳統的 Python 環境思路：

- `pip3 install -r requirements.txt`
- `uvicorn app:app --host 0.0.0.0 --port 8000`

不依賴 `uv`、poetry 或 monorepo 特殊工具。

## 1. 這個 mock-target 對應 MyTeleBot 的哪段契約

MyTeleBot 目前 dispatch 的核心判定是：

- `2xx` 且 body 不是 `{"ok": false}` -> 視為成功
- `2xx` 且 body 是 `{"ok": false, ...}` -> 視為 business error
- `4xx/5xx` -> 視為 HTTP error
- 逾時或連不到 -> 視為 network timeout / network error

所以這個 mock-target 也刻意支援：

- `success`
- `business_error`
- `http_error`
- `timeout`

## 2. 目錄內容

```text
mock-target/
  app.py
  requirements.txt
  render.yaml
  README.md
  TODO.md
```

## 3. 本機啟動方式

### 安裝依賴

```bash
cd mock-target
python3 -m venv .venv
. .venv/bin/activate
pip3 install -r requirements.txt
```

### 啟動

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

啟動後可先測：

```bash
curl http://127.0.0.1:8000/health
```

## 4. 環境變數

### Target auth

- `MOCK_TARGET_AUTH_TYPE`
  - 可用值：`none`、`bearer`、`header`、`query`、`hmac`
  - 預設：`none`

- `MOCK_TARGET_AUTH_SECRET`
  - Target secret
  - 預設：`dev-secret`

### Mock 行為

- `MOCK_TARGET_TIMEOUT_SECONDS`
  - timeout mode 的預設延遲秒數
  - 預設：`12`

- `MOCK_TARGET_HTTP_ERROR_STATUS`
  - http_error mode 的預設狀態碼
  - 預設：`500`

- `MOCK_TARGET_BUSINESS_ERROR_MESSAGE`
  - business_error mode 的預設錯誤訊息
  - 預設：`mock target rejected the command`

### 記錄與管理

- `MOCK_TARGET_MAX_REQUEST_LOGS`
  - 記憶體中保留最近幾筆 request
  - 預設：`200`

- `MOCK_TARGET_ADMIN_TOKEN`
  - 若有設定，`/_mock/*` 管理端點必須帶 `X-Mock-Admin-Token`
  - 預設：未設定

## 5. 主要 endpoints

### `GET /health`

給 MyTeleBot 的 `testTargetConnection()` 使用。

如果 auth 設定正確，會回：

```json
{
  "ok": true,
  "mock": true,
  "service": "mytelebot-mock-target",
  "version": "0.1.0",
  "authType": "none",
  "responseMode": "success",
  "requestLogCount": 0,
  "timestamp": "2026-04-02T00:00:00Z"
}
```

### `ANY /{path:path}`

真正接 MyTeleBot dispatch 的 catch-all route。

也就是說，MyTeleBot 的 command path 不需要先在這邊逐條宣告。

例如：

- `/device/living-room-ac/power`
- `/api/v1/ac/set-temperature`
- `/mock/home/switch/1`

都可以收。

### `GET /_mock/info`

查看 mock-target 的基本狀態與可用端點。

### `GET /_mock/ping`

公開 ping endpoint。

用途：

- 給 cron-job / uptime monitor 定時戳
- 避免 Render free service 因閒置而 spin down
- 不檢查 target bearer auth

回傳範例：

```json
{
  "ok": true,
  "public": true,
  "service": "mytelebot-mock-target",
  "version": "0.1.0",
  "timestamp": "2026-04-03T00:00:00Z"
}
```

### `GET /_mock/config`

查看目前 response mode。

### `PUT /_mock/config`

切換 mock 回應模式。

例如：

```bash
curl -X PUT http://127.0.0.1:8000/_mock/config \
  -H 'Content-Type: application/json' \
  -d '{
    "responseMode": "business_error",
    "businessErrorMessage": "device is offline"
  }'
```

可用模式：

- `success`
- `business_error`
- `http_error`
- `timeout`

### `GET /_mock/requests`

列出最近收到的 request。

```bash
curl http://127.0.0.1:8000/_mock/requests
```

### `GET /_mock/requests/{requestId}`

查看單筆詳細 request 紀錄。

### `DELETE /_mock/requests`

清掉目前 request log，方便重測。

## 6. 會記錄哪些內容

每筆 request 會記錄：

- `requestId`
- `receivedAt`
- `method`
- `path`
- `query`
- `headers`
- `contentLength`
- `bodyText`
- `bodyJson`
- `bodyError`
- `auth`
- `response`

敏感資訊會遮罩，例如：

- `Authorization`
- `X-Target-Secret`
- `X-Target-Signature`
- `token` query 參數

## 7. 支援的 auth 對應方式

這個 mock-target 會刻意模擬 MyTeleBot 的 target auth 行為。

### `none`

不驗證任何認證資訊。

### `bearer`

期待：

```http
Authorization: Bearer <secret>
```

### `header`

期待：

```http
X-Target-Secret: <secret>
```

### `query`

期待：

```text
?token=<secret>
```

### `hmac`

期待：

```http
X-Target-Timestamp: <unix-seconds>
X-Target-Signature: sha256=<hex>
```

簽章格式與 MyTeleBot 目前實作一致：

```text
timestamp.METHOD.pathWithQuery.bodyText
```

再用 `HMAC-SHA256` 計算。

## 8. MyTeleBot 建議怎麼接

在 MyTeleBot 的 `/admin/registry` 建立 target 時，建議先用：

- `Base URL`: `https://<your-mock-target>.onrender.com`
- `Auth type`: 先用 `none` 或 `bearer`
- `Timeout`: `8000` ms 左右

command 可以先設成：

- `method`: `POST`
- `path`: `/device/living-room-ac/set-temperature`
- `payloadTemplateJson`:

```json
{
  "state": "{{state}}",
  "temperature": "{{temperature}}"
}
```

這樣你在 mock-target 的 request log 就能直接看到未來家庭 API 大概要接什麼。

## 9. Render 部署方式

如果你把這個子專案分出去成獨立 repo，Render 可以直接這樣配：

- Runtime: `Python`
- Root Directory: repo root
- Build Command:

```bash
pip3 install -r requirements.txt
```

- Start Command:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

這個 repo 內也附了一份 `render.yaml` 可做參考。

## 10. 建議的雲端 debug 流程

1. 部署 mock-target 到 Render
2. 用 `GET /health` 先確認活著
   如果你是給 cron-job 用，請改打 `GET /_mock/ping`
3. 在 MyTeleBot 建立 `Target`
4. 用 `Test target connection`
5. 建立 `Device` / `Command`
6. 先用 `dry run command`
7. 再從 Telegram 真送一次
8. 到 `/_mock/requests` 看實際 request

## 11. 現階段刻意不做的事

這個 mock-target 是為了 debug 契約，不是為了做真實家庭控制，所以目前刻意不做：

- 永久儲存 request logs
- 真正的設備狀態機
- 真實硬體整合
- 資料庫
- 複雜權限系統

它的定位是：

- request recorder
- target contract probe
- future home API design aid
