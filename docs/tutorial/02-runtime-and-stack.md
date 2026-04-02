# 02. 這個專案用到哪些技術

## 1. 技術堆疊，用初學者能懂的方式說

### `Node.js`

這是 JavaScript 在伺服器端執行的 runtime。

你可以把它理解成：

- 瀏覽器也能跑 JavaScript
- 伺服器也能跑 JavaScript
- 這個專案伺服器端就是跑在 Node.js 上

本專案目前釘選的版本是 `24.13.0`。

你會在這幾個地方看到：

- 根目錄 [`.nvmrc`](/home/mimas/projects/mytelebot/.nvmrc)
- 根目錄 [`.node-version`](/home/mimas/projects/mytelebot/.node-version)
- 根目錄 [`package.json`](/home/mimas/projects/mytelebot/package.json) 的 `engines.node`

如果你在本機使用 `nvm`，通常可以直接：

```bash
nvm use
```

## 1.1 在 monorepo 裡，指令通常要在哪裡跑

這個專案雖然目前只有一個主要 app，但結構上已經是 workspace / monorepo 形式。

初學者最常卡住的問題是：

- 我要在 root 跑 `npm install` 嗎？
- 還是要先 `cd apps/web`？

你可以先這樣記：

- root：安裝整個 workspace 依賴、執行總入口 script
- `apps/web`：執行 Next.js app 自己的指令

最常見的實務分工是：

```bash
# 在 repo root
npm install
npm run build
npm run test:core

# 在 apps/web
npm run dev
next build
next start
```

如果你不確定，就先看你要執行的是：

- root `package.json` 的 script
- 還是 `apps/web/package.json` 的 script

### `Next.js`

這個專案的核心框架。

在這個專案裡，`Next.js` 同時負責：

- 網站頁面
- 管理後台
- API routes
- server-side rendering
- server actions

這就是為什麼這個 repo 裡沒有另外一個 `Express` 或 `Koa` server。

### `React`

`React` 是用來組頁面的 UI library。

在這個專案裡，你不用先把它想成太抽象的東西。
先把它理解成：

- 畫頁面的方式
- 用元件把畫面拆成小片段
- 表單和頁面都由 React 組成

本專案目前使用的是 `React 19`。

這點很重要，因為有些 API 是新版才有，例如登入表單裡的 `useActionState()`。

### `Prisma`

這是 ORM。

初學者版本的說法：

- 你不用自己手寫很多 SQL
- 可以用 JavaScript 呼叫 `prisma.user.findUnique(...)`
- Prisma 會幫你去查 SQLite

### `SQLite`

這是資料庫，但不是獨立伺服器型資料庫。

初學者版本的說法：

- 它本質上是一個檔案
- 應用程式直接打開這個檔案來查資料
- 很適合單機原型
- 不適合多 instance 同時共用

## 2. 為什麼這個專案看起來像前端，實際上是全端

因為它把前後端都放在同一個 Next.js app 裡。

例如：

- `/login` 是頁面
- `/admin/providers` 是頁面
- `/api/telegram/webhook` 是後端 API
- `createProviderAction()` 是 server action
- `prisma.user.findUnique()` 是資料庫操作

所以這不是只有前端，也不是只有 API server，而是單體式 full-stack app。

## 3. `App Router` 是什麼

這個專案使用的是 Next.js 的 `App Router`。

你可以先把它理解成檔案路由規則：

- `app/page.js` 對應 `/`
- `app/login/page.js` 對應 `/login`
- `app/admin/providers/page.js` 對應 `/admin/providers`
- `app/api/telegram/webhook/route.js` 對應 `/api/telegram/webhook`

這種設計的好處是：

- 看路徑就能找到入口檔案
- 初學者很容易從 URL 反查程式碼

另外你在某些頁面會看到：

```js
export const dynamic = "force-dynamic";
```

這是 Next.js 的頁面級設定，代表：

- 不要把這個頁面當成靜態快取內容
- 每次請求都重新執行伺服器邏輯

這對像 `/login`、`/admin/*` 這類依賴 session 或資料庫狀態的頁面很重要。

## 4. `Server Action` 在這裡扮演什麼角色

`Server Action` 是 Next.js 的一種伺服器函式寫法。

你會在很多檔案看到：

```js
"use server";
```

這代表這個檔案裡的函式會在伺服器執行，不是在瀏覽器執行。

在本專案裡，Server Action 主要用來處理：

- 登入表單
- provider CRUD
- registry CRUD
- system backup/restore

它們通常長這樣：

```text
form submit
-> server action
-> requireAdminSession()
-> 呼叫 lib service
-> Prisma 寫 DB
-> revalidatePath()
```

和它成對的另一個概念是 Client Component。

## 5. `"use client"` 是什麼

在 App Router 裡，元件預設是伺服器端元件。

如果你看到：

```js
"use client";
```

代表這個元件要在瀏覽器端執行。

例如登入表單 [`apps/web/app/login/form.js`](/home/mimas/projects/mytelebot/apps/web/app/login/form.js)：

- 有 `"use client"`
- 使用 React 19 的 `useActionState`
- 需要即時互動與 pending 狀態

所以它不能只是純 server component。

## 6. `Route Handler` 在這裡扮演什麼角色

`Route Handler` 是 Next.js 內建的 API route 寫法。

本專案的重要 Route Handlers：

- `/api/health`
- `/api/health/db`
- `/api/health/targets`
- `/api/metrics`
- `/api/telegram/webhook`

它們的用途是：

- 回 JSON
- 被外部服務呼叫
- 不直接渲染 HTML 頁面

## 7. `lib/*` 代表什麼

`app/` 裡的檔案是入口。
`lib/` 裡的檔案是邏輯核心。

你可以先把它理解成：

- `app/`：控制從哪裡進來
- `lib/`：真正做事的地方

例如：

- `/api/telegram/webhook` 只是入口
- 真正的 allowlist、audit log、dispatch、provider load 都在 `apps/web/lib/*`

有些 `lib` 檔案最上面會出現這種寫法：

```js
import "@/lib/server-env";
```

這種寫法叫 side-effect import。

意思不是「我要取出某個函式」，而是：

- 只要 import 這個檔案
- 就先執行它裡面的初始化邏輯

在這個專案裡，這通常是為了先載入 `.env`。

## 8. `.env` 是怎麼被載入的

這個專案實際上有兩條環境變數載入路徑：

### A. `apps/web/lib/server-env.js`

它會：

- 從目前工作目錄往上找 `.env`
- 找到後用 `dotenv` 載入

這就是為什麼很多 server-side 模組一開始就：

```js
import "@/lib/server-env";
```

### B. `apps/web/next.config.mjs`

它會使用 `@next/env` 的 `loadEnvConfig(workspaceRoot)`。

可以先把它理解成：

- Next.js 啟動時也會從 workspace root 載入 `.env`

如果你之後遇到「環境變數怎麼沒生效」，這兩個檔案就是第一個該看的地方。

## 9. monorepo 與 workspace 是什麼

根目錄 [`package.json`](/home/mimas/projects/mytelebot/package.json) 有：

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

這代表這個 repo 使用 `npm workspaces` 管理多個子專案。

目前你可以先把它理解成：

- 根目錄是 workspace 管理層
- `apps/web/` 是現在真正運作的網站
- `packages/` 目前只是預留位置，還沒有拆出共用模組

對初學者最重要的實務結論是：

- `npm install` 在根目錄執行
- 平常看網站程式碼，主要看 `apps/web/`

## 10. `@/` 路徑別名是什麼

你會常看到：

```js
import { prisma } from "@/lib/prisma";
```

這不是 npm 套件，而是路徑別名。

設定來自 [`apps/web/jsconfig.json`](/home/mimas/projects/mytelebot/apps/web/jsconfig.json)：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

所以在 `apps/web/` 這個 app 裡：

- `@/lib/prisma` 等於 `apps/web/lib/prisma`
- `@/app/login/actions` 等於 `apps/web/app/login/actions`

## 11. `.js` 和 `.mjs` 有什麼差別

本專案兩種副檔名都有：

- `.js`
- `.mjs`

對初學者可以先這樣理解：

- `.js`：主要的 Next.js 模組與頁面
- `.mjs`：明確使用 ESM 形式的工具模組

在這個專案中，像 `*-utils.mjs` 通常偏向：

- 純工具函式
- 比較容易被單獨測試
- 不直接依賴 Next.js page/route 結構

你第一次讀程式時，不需要先深究 Node.js 模組史，只要知道它們本質上都還是在寫 JavaScript 模組即可。

## 12. 這個專案其實沒有用到哪些更重的東西

你可能以為它用了很多大型框架，但目前沒有。

目前沒有看到：

- Redux
- Zustand
- Express
- NestJS
- GraphQL
- Kafka
- RabbitMQ

這代表它仍然是相對容易理解的單體架構。

## 13. 初學者最值得先記住的觀念

如果你現在只想先抓住核心，先記住這 5 句：

1. 這是一個 `Next.js` 單體應用。
2. 頁面、API、表單提交都在同一個 app 裡。
3. `lib/*` 是主要商業邏輯。
4. `Prisma` 是 JavaScript 和資料庫之間的橋。
5. `SQLite` 是目前的單檔資料庫。
