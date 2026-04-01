# 系統架構規劃

## 1. 專案目標
建立一套以 JavaScript 為主的 Telegram Bot 平台，包含：
- Telegram Bot 指令處理與對話回覆
- 可由管理後台抽換的雲端 LLM 模型
- 以登入控管保護模型設定、API Key 與設備控制規則
- 家電控制目標與命令白名單管理
- 部署相容 `Vercel` 與 `Render`

## 2. 技術堆疊建議

### 2.1 前端
- Framework: `Next.js` `App Router`
- UI: `React` + 專案內建全域樣式
- Auth UI: 原型階段採自建 login form + 受保護路由
- Form: 原型階段採 server actions + HTML form

選擇理由：
- `Next.js` 同時處理前端頁面、後端 API 與部署整合，降低切分成本
- 可直接部署到 `Vercel`，也可在 `Render` 以 Node server 方式運行

### 2.2 後端
- Runtime: `Node.js 24 LTS`
- API: `Next.js Route Handlers`
- Bot adapter: 原型階段採 Telegram HTTP API + webhook route
- Schema validation: 原型階段採自寫 JSON 驗證
- HTTP client: 原生 `fetch`
- Queue/Cache: `Upstash Redis` 或 `BullMQ` + Redis

目前現況：
- Telegram 收送訊息由 `apps/web/lib/telegram.js` 直接處理
- 尚未拆出獨立 bot framework layer

### 2.3 資料庫
- Prototype DB: `SQLite`
- ORM: `Prisma`
- Deployment storage: `Render Persistent Disk`

原型階段選擇理由：
- 建置速度快，便於單機原型快速成型
- 管理設定、設備白名單、audit log 都可先落在單一檔案
- Prisma 可保留未來升級到 PostgreSQL 的遷移空間

限制：
- 僅適合單實例部署
- DB 檔案必須放在 Persistent Disk 掛載路徑
- 備份、回復、部署切換都需要額外設計

### 2.4 身份驗證與權限
- Prototype auth: 自建 session login
- Bootstrap admin: 由 `.env` 中的 `ADMIN_USER`、`ADMIN_PASSWORD` 初始化第一個管理者
- Role: `admin`, `operator`, `viewer`

原型階段理由：
- 可避開第三方 OAuth 設定成本
- 先把管理後台、provider、device registry 做起來
- 等原型穩定後再替換成 `Auth.js`

### 2.5 機密資料保護
- API Key 不明文存入資料庫
- 使用 `AES-256-GCM` 對稱加密後儲存
- 加密主金鑰使用環境變數：`APP_ENCRYPTION_KEY`
- 所有 provider key、設備 token、webhook secret 都走 secrets layer

## 3. 核心子系統

### 3.1 Telegram Bot 子系統
責任：
- 接收 Telegram webhook
- 驗證訊息來源與授權使用者
- 將訊息交給意圖解析與工具調度流程
- 回傳執行結果或錯誤訊息
- 回傳帶 reason code 與 operator hint 的執行摘要

### 3.2 LLM Provider Router
責任：
- 以 OpenAI-compatible 介面呼叫不同供應商
- 將 `baseURL`, `model`, `apiKey`, `headers` 抽象化
- 支援 provider capability profile 與 JSON strictness 設定
- 支援主模型與備援模型切換
- 統一回傳格式，避免上層綁死單一供應商

支援範圍：
- OpenAI
- OpenRouter
- Together
- Groq
- Fireworks
- 自架 OpenAI-compatible gateway

### 3.3 Device Registry 與 Command Policy
責任：
- 儲存每個 target server 的 URL、驗證方式與設備列表
- 儲存每台設備允許的命令集合
- 儲存每台設備允許的名稱別名（aliases）
- 儲存每個 command 的別名（command aliases）
- 將可執行命令轉成 LLM 可理解的結構化上下文
- 在真正送出設備呼叫前做白名單驗證

### 3.4 Device Dispatcher
責任：
- 接收已驗證的控制命令
- 組合對應 `url`, `method`, `headers`, `payload`
- 呼叫目標端 API
- 寫入審計紀錄與結果

### 3.5 Admin Console
責任：
- 管理 LLM providers
- 設定當前 active provider/model
- 輪替 provider API key 並保留 secret 歷史
- 測試 provider 與 target 連線
- 管理 Telegram allowlist
- 將 Telegram allowlist 帳號連結到已存在的 admin user
- 管理 target server、device、command schema
- 查看審計日誌與失敗紀錄
- 建立與回復 SQLite 備份，並保留 rollback safeguard
- 查看結構化 operational metrics 與近期營運事件

## 4. 建議部署架構

### 4.1 Render 優先模式
適用：
- 需要較穩定 Node runtime
- 原型先採單一 web service
- 後續可能加入背景 worker

組成：
- `Web Service`: Next.js server
- `Persistent Disk`: 保存 SQLite、匯出檔、暫存備份
- `Worker Service`: 第二階段再加入
- Telegram webhook 指向 `https://your-domain/api/telegram/webhook`

優點：
- 背景任務與長連線支援較彈性
- Node server 行為較可控
- 可直接把 SQLite 放在 Render disk 上

限制：
- 只能單 instance
- 使用 Persistent Disk 時，部署流程要考慮資料一致性
- SQLite 不適合高併發與多副本

### 4.2 Vercel 作為後備選項
適用：
- 之後若管理介面與 API 更偏 serverless
- 將 SQLite 遷移到 PostgreSQL 後

目前不建議原型第一階段採用：
- `Vercel` 不適合把 SQLite 當成主資料檔落地保存
- 你的需求同時包含 webhook、管理後台、備份回復 API，`Render` 較穩

### 4.3 關於家庭內網設備
若目標家電 API 位於私有網段，雲端無法直接連線，需擇一：
- 在家中部署 `home-gateway`，由雲端呼叫該 gateway 的公開 HTTPS endpoint
- 使用 Cloudflare Tunnel、Tailscale Funnel、反向代理等安全通道
- 讓家庭 gateway 主動向雲端輪詢待執行命令

這部分是整個家電控制方案的必要前提，不可略過。

## 5. 資料流設計

### 5.1 模型管理流程
1. 管理者登入後台
2. 新增或修改 provider 設定
3. 測試連線成功後標記為 active
4. Bot 執行時從 active provider 載入設定

### 5.2 Telegram 控制流程
1. 使用者送出自然語言，例如「把客廳冷氣開到 25 度」
2. Bot 驗證該 Telegram user 是否在 allowlist
3. 系統載入可用 target/device/command 摘要
4. 將使用者輸入與控制白名單一起送給 LLM
5. LLM 只回傳結構化命令 JSON
6. 後端驗證 JSON 是否符合 schema 與白名單
7. 驗證通過後由 dispatcher 呼叫目標 API
8. 將結果回報給 Telegram，並寫入 audit log

### 5.3 為何不能讓 LLM 直接控制 URL
原因：
- LLM 可能產生未定義命令
- LLM 可能猜錯欄位名稱或 payload 結構
- LLM 若可自由指定 URL，等於擴大 SSRF 與誤控風險

因此應採：
- LLM 只輸出 `target_id`, `device_id`, `command_id`, `args`
- 真正的 `url`, `method`, `payload template` 由伺服器端 registry 決定
- 後端仍需驗證原始文字是否明確提到對應裝置或其 alias，避免 LLM 幻覺誤控

## 6. 安全設計
- 所有管理頁都必須登入後可見
- 只有 `admin` 可修改 provider API keys 與設備 endpoint
- Telegram user 需在 allowlist 內才可下控制命令
- 高風險命令可要求二次確認，例如 `unlock_door`, `power_off_server`
- Audit log 必須記錄：操作者、原始訊息、解析結果、實際呼叫內容摘要、成功或失敗
- 所有 target endpoint 都應有 request signature 或 API token
- 目標設備端也應限制來源 IP 或驗證簽章

## 7. MVP 範圍
第一階段只做：
- Telegram webhook bot
- 管理登入
- OpenAI-compatible provider CRUD
- 單一 active provider 切換
- target server/device/command CRUD
- LLM 結構化解析
- 單步設備控制與 audit log
- SQLite 備份與回復管理 API

目前已落地：
- webhook -> parse -> validate -> dispatch -> Telegram reply 主流程
- audit log UI
- mock target device server
- device alias 白名單與明確命中檢查
- provider edit flow
- command alias 白名單與 command edit
- SQLite backup create / list admin UI
- SQLite restore UI with integrity check and pre-restore backup
- Telegram `update_id` dedupe
- health endpoints for app / db / targets
- fixture-based webhook integration test tooling

先不做：
- 多輪對話記憶
- 排程自動化
- 語音輸入
- 視覺辨識
- 複雜工作流編排

## 8. 第二階段可擴充
- 排程任務與自動化規則
- 多使用者與群組權限
- 裝置狀態查詢與快取
- 多家庭據點
- Plugin 式工具調度
- 模型成本追蹤與自動 fallback

## 9. 遷移說明
- 若要從單機 SQLite 遷移到 PostgreSQL，請參考：
  - `docs/sqlite-to-postgres-migration.md`
