# 08. API 與頁面盤點

## 1. 頁面清單

### `/`

檔案：

- `apps/web/app/page.js`

用途：

- 首頁
- 顯示專案概覽
- 連到 `/login`

### `/login`

檔案：

- `apps/web/app/login/page.js`
- `apps/web/app/login/form.js`
- `apps/web/app/login/actions.js`

用途：

- 管理員登入

### `/admin`

檔案：

- `apps/web/app/admin/page.js`

用途：

- dashboard

### `/admin/providers`

檔案：

- `apps/web/app/admin/providers/page.js`
- `apps/web/app/admin/providers/form.js`
- `apps/web/app/admin/providers/actions.js`

用途：

- provider CRUD
- rotate API key
- test connection

### `/admin/registry`

檔案：

- `apps/web/app/admin/registry/page.js`
- `apps/web/app/admin/registry/forms.js`
- `apps/web/app/admin/registry/actions.js`

用途：

- target / device / command CRUD
- target connection test
- command dry run

注意：

- 這一頁的表單檔名是 `forms.js`，不是 `form.js`
- 因為同一頁裡包含多個表單

### `/admin/telegram`

檔案：

- `apps/web/app/admin/telegram/page.js`
- `apps/web/app/admin/telegram/form.js`
- `apps/web/app/admin/telegram/actions.js`

用途：

- Telegram allowlist 管理

### `/admin/audit`

檔案：

- `apps/web/app/admin/audit/page.js`

用途：

- 查看 audit logs

這一頁目前只有 `page.js`，沒有 `form.js` 或 `actions.js`。

原因是它目前是純讀取頁面：

- 查詢資料
- 顯示資料
- 沒有表單提交流程

### `/admin/system`

檔案：

- `apps/web/app/admin/system/page.js`
- `apps/web/app/admin/system/form.js`
- `apps/web/app/admin/system/actions.js`

用途：

- backup / restore
- operational metrics

## 2. API 清單

### `GET /api/health`

檔案：

- `apps/web/app/api/health/route.js`

用途：

- 最基本的 service health

回傳：

- `ok`
- `service`
- `version`
- `status`
- `timestamp`

補充：

- 目前這個 endpoint 會回傳 `1.0.3`
- 這和根目錄 [`package.json`](/home/mimas/projects/mytelebot/package.json) 與 [`apps/web/package.json`](/home/mimas/projects/mytelebot/apps/web/package.json) 的目前版號一致
- 如果未來專案升版，這裡也要一起更新，否則 health API 顯示的版本會落後

### `GET /api/health/db`

檔案：

- `apps/web/app/api/health/db/route.js`

用途：

- 檢查資料庫是否可查詢

核心動作：

```js
await prisma.$queryRaw`SELECT 1`;
```

### `GET /api/health/targets`

檔案：

- `apps/web/app/api/health/targets/route.js`

用途：

- 對所有 target 做連線檢查

### `GET /api/metrics`

檔案：

- `apps/web/app/api/metrics/route.js`

用途：

- 回傳系統統計與近期事件

資料來源：

- `apps/web/lib/system.js`

### `POST /api/telegram/webhook`

檔案：

- `apps/web/app/api/telegram/webhook/route.js`

用途：

- Telegram bot 的主入口

這是整個專案最重要的 API。

## 3. Server Actions 清單

### Login

- `loginAction`
- `logoutAction`

### Provider actions

- `createProviderAction`
- `setDefaultProviderAction`
- `updateProviderAction`
- `rotateProviderApiKeyAction`
- `toggleProviderStatusAction`
- `deleteProviderAction`
- `testProviderConnectionAction`

### Registry actions

- `createTargetAction`
- `createDeviceAction`
- `updateTargetAction`
- `createCommandAction`
- `updateDeviceAction`
- `updateCommandAction`
- `testTargetConnectionAction`
- `dryRunCommandAction`
- `toggleTargetStatusAction`
- `toggleDeviceStatusAction`
- `toggleCommandStatusAction`
- `deleteTargetAction`
- `deleteDeviceAction`
- `deleteCommandAction`

### System actions

- `createBackupAction`
- `restoreBackupAction`

### Telegram admin actions

- `createTelegramAccountAction`
- `toggleTelegramAccountStatusAction`
- `updateTelegramAccountAction`
- `deleteTelegramAccountAction`

## 4. API 與頁面的分工

一個很容易混淆的地方是：

- 頁面 route：回 HTML / React UI
- API route：回 JSON
- Server action：多半由 HTML form 直接呼叫，不是公開 API

你可以把它們理解成：

```text
型別          | 例子                              | 觸發方式              | 主要回傳
頁面 route    | /admin/providers/page.js          | 瀏覽器網址            | HTML / React UI
API route     | /api/health/route.js              | fetch / 外部服務呼叫  | JSON
Server action | /admin/providers/actions.js       | form submit           | 交還頁面狀態並 revalidate
```

### 頁面 route

給人看的頁面。

### API route

給程式或外部系統打的 URL。

### Server action

給本網站內部表單使用的伺服器函式。

## 5. 如果你要追一條功能，怎麼找

### 例子 A：provider CRUD

```text
/admin/providers
-> providers/page.js
-> providers/form.js
-> providers/actions.js
-> lib/providers.js
-> prisma
```

### 例子 B：Telegram webhook

```text
/api/telegram/webhook
-> route.js
-> lib/telegram.js
-> lib/llm.js
-> lib/registry.js
-> lib/dispatcher.js
-> prisma
```

### 例子 C：system backup

```text
/admin/system
-> system/form.js
-> system/actions.js
-> lib/system.js
-> fs + prisma
```
