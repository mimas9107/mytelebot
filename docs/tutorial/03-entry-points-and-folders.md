# 03. 入口點與資料夾導覽

## 1. 最重要的目錄

```text
mytelebot/
  apps/web/
    app/
    lib/
  prisma/
  docs/
  scripts/
  package.json
```

這裡要先補一個初學者最容易卡住的點：

- 你看到根目錄有一個 `package.json`
- `apps/web/` 裡也有一個 `package.json`

這不是重複，而是因為這個 repo 使用 `npm workspaces`。

實務上你可以這樣記：

- 在根目錄執行 `npm install`
- 真正的網站原始碼主要在 `apps/web/`
- `packages/` 目前還是空的預留區

## 2. `apps/web/app` 是什麼

這裡放的是 `Next.js App Router` 的入口檔案。

### 頁面入口

- `apps/web/app/page.js`
- `apps/web/app/login/page.js`
- `apps/web/app/admin/page.js`
- `apps/web/app/admin/providers/page.js`
- `apps/web/app/admin/registry/page.js`
- `apps/web/app/admin/telegram/page.js`
- `apps/web/app/admin/audit/page.js`
- `apps/web/app/admin/system/page.js`

### API 入口

- `apps/web/app/api/health/route.js`
- `apps/web/app/api/health/db/route.js`
- `apps/web/app/api/health/targets/route.js`
- `apps/web/app/api/metrics/route.js`
- `apps/web/app/api/telegram/webhook/route.js`

### Server Action 入口

- `apps/web/app/login/actions.js`
- `apps/web/app/admin/providers/actions.js`
- `apps/web/app/admin/registry/actions.js`
- `apps/web/app/admin/system/actions.js`
- `apps/web/app/admin/telegram/actions.js`

## 3. `apps/web/lib` 是什麼

這裡放的是核心邏輯模組。

### 與登入相關

- `apps/web/lib/auth/bootstrap.js`
- `apps/web/lib/auth/session.js`
- `apps/web/lib/password.js`

### 與資料庫相關

- `apps/web/lib/prisma.js`
- `apps/web/lib/encryption.js`

### 與 provider 相關

- `apps/web/lib/providers.js`
- `apps/web/lib/llm.js`
- `apps/web/lib/llm-utils.mjs`

### 與 registry / device policy 相關

- `apps/web/lib/registry.js`
- `apps/web/lib/registry-utils.mjs`

注意這裡的 `registry` 管理頁表單檔名是 [`apps/web/app/admin/registry/forms.js`](/home/mimas/projects/mytelebot/apps/web/app/admin/registry/forms.js)，不是 `form.js`。

原因是它同一頁裡放了多種表單：

- target form
- device form
- command form

### 與 dispatch 相關

- `apps/web/lib/dispatcher.js`
- `apps/web/lib/dispatcher-utils.mjs`

### 與 Telegram 相關

- `apps/web/lib/telegram.js`
- `apps/web/lib/telegram-utils.mjs`

### 與維運相關

- `apps/web/lib/audit.js`
- `apps/web/lib/system.js`
- `apps/web/lib/server-env.js`

## 4. `prisma/` 是什麼

這裡放資料庫 schema 與 migration。

最重要的是：

- `prisma/schema.prisma`
- `prisma/migrations/*`

如果你要知道有哪些資料表，先看 `schema.prisma`。

如果你要知道資料表是如何一步步變成現在這樣，去看 `migrations/`。

另外根目錄還有一個 [`prisma.config.ts`](/home/mimas/projects/mytelebot/prisma.config.ts)。

它是 Prisma CLI 的設定檔，主要用途是告訴 Prisma：

- schema 在哪裡
- migrations 在哪裡
- datasource URL 從哪裡拿

雖然副檔名是 `.ts`，但它不代表整個專案是 TypeScript 專案。

## 5. `scripts/` 是什麼

這裡不是正式 runtime 的主程式，而是輔助腳本。

目前主要用途：

- mock device server
- mock LLM server
- mock Telegram server
- 測試腳本

也就是說，`scripts/` 偏向開發與驗證工具，不是產品主邏輯。

## 6. 初學者最常用的入口反查法

### 從網址找入口檔案

例子：

- `/login` -> `apps/web/app/login/page.js`
- `/admin/registry` -> `apps/web/app/admin/registry/page.js`
- `/api/metrics` -> `apps/web/app/api/metrics/route.js`

### 從表單找 server action

通常頁面會匯入一個 action，例如：

```text
page/form
-> actions.js
-> lib/*.js
-> prisma
```

### 從錯誤訊息找 `lib` 核心

很多功能性的錯誤最後都會落在：

- `providers.js`
- `registry.js`
- `telegram.js`
- `dispatcher.js`
- `system.js`

## 7. 進入點索引

如果你要快速理解整個專案，建議從這些點進去：

### 第一組：網站入口

- `apps/web/app/layout.js`
- `apps/web/app/page.js`
- `apps/web/app/login/page.js`
- `apps/web/app/admin/page.js`

目前 `apps/web/app/admin/` 底下沒有共用的 `layout.js`。

這代表：

- `/admin`
- `/admin/providers`
- `/admin/registry`
- `/admin/system`
- `/admin/telegram`
- `/admin/audit`

目前都是各自獨立的頁面，不是共享同一個後台 layout 元件。

### 第二組：登入流程

- `apps/web/app/login/actions.js`
- `apps/web/lib/auth/bootstrap.js`
- `apps/web/lib/auth/session.js`
- `apps/web/lib/password.js`

### 第三組：Telegram 主流程

- `apps/web/app/api/telegram/webhook/route.js`
- `apps/web/lib/telegram.js`
- `apps/web/lib/llm.js`
- `apps/web/lib/registry.js`
- `apps/web/lib/dispatcher.js`

### 第四組：資料模型

- `prisma/schema.prisma`
- `apps/web/lib/prisma.js`

## 8. 一個實用的讀法

建議你第一次讀這個專案時，不要一開始就從 `lib/registry.js` 這種大檔硬讀。

先從入口檔案開始：

1. 看頁面或 route
2. 看它 import 了哪些 action / lib
3. 再進去看對應 `lib`

這樣比較能維持方向感。
