# 02. 這個專案用到哪些技術

## 1. 技術堆疊，用初學者能懂的方式說

### `Node.js`

這是 JavaScript 在伺服器端執行的 runtime。

你可以把它理解成：

- 瀏覽器也能跑 JavaScript
- 伺服器也能跑 JavaScript
- 這個專案伺服器端就是跑在 Node.js 上

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

## 5. `Route Handler` 在這裡扮演什麼角色

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

## 6. `lib/*` 代表什麼

`app/` 裡的檔案是入口。
`lib/` 裡的檔案是邏輯核心。

你可以先把它理解成：

- `app/`：控制從哪裡進來
- `lib/`：真正做事的地方

例如：

- `/api/telegram/webhook` 只是入口
- 真正的 allowlist、audit log、dispatch、provider load 都在 `apps/web/lib/*`

## 7. 這個專案其實沒有用到哪些更重的東西

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

## 8. 初學者最值得先記住的觀念

如果你現在只想先抓住核心，先記住這 5 句：

1. 這是一個 `Next.js` 單體應用。
2. 頁面、API、表單提交都在同一個 app 裡。
3. `lib/*` 是主要商業邏輯。
4. `Prisma` 是 JavaScript 和資料庫之間的橋。
5. `SQLite` 是目前的單檔資料庫。
