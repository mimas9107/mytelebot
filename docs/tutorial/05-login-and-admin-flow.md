# 05. 登入與管理後台流程

## 1. 先看登入頁

登入頁入口：

- `apps/web/app/login/page.js`

登入提交 action：

- `apps/web/app/login/actions.js`

登入相關核心邏輯：

- `apps/web/lib/auth/bootstrap.js`
- `apps/web/lib/auth/session.js`
- `apps/web/lib/password.js`

另外要注意兩個 Next.js / React 細節：

- [`apps/web/app/login/page.js`](/home/mimas/projects/mytelebot/apps/web/app/login/page.js) 設了 `export const dynamic = "force-dynamic"`
- [`apps/web/app/login/form.js`](/home/mimas/projects/mytelebot/apps/web/app/login/form.js) 是 `"use client"` 元件，並使用 React 19 的 `useActionState`

## 2. 這個專案沒有用第三方 auth 套件

這個專案目前沒有使用 `Auth.js` 或 OAuth。

它用的是自建的簡化登入模型：

1. 從 `.env` 讀 `ADMIN_USER`、`ADMIN_PASSWORD`
2. 第一次使用時，自動建立 bootstrap admin
3. 使用自簽 session cookie 記錄登入狀態

## 3. Bootstrap admin 是什麼

檔案：

- `apps/web/lib/auth/bootstrap.js`

核心片段：

```js
export async function ensureBootstrapAdmin() {
  const credentials = getBootstrapAdminCredentials();

  if (!credentials) {
    return { ready: false, reason: "missing_admin_env" };
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { username: credentials.username }
  });

  if (existingAdmin) {
    return { ready: true, userId: existingAdmin.id };
  }

  const admin = await prisma.user.create({
    data: {
      username: credentials.username,
      passwordHash: hashPassword(credentials.password),
      role: "admin",
      status: "active"
    }
  });

  return { ready: true, userId: admin.id };
}
```

意思是：

- 如果 `.env` 裡有 admin 帳密
- 但 DB 還沒有這個使用者
- 系統就會自動建立第一個 admin

這就是 bootstrap admin。

## 4. 登入 action 的流程

檔案：

- `apps/web/app/login/actions.js`

核心片段：

```js
export async function loginAction(_previousState, formData) {
  await ensureBootstrapAdmin();

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid credentials." };
  }

  await createSession({
    userId: user.id,
    role: user.role,
    username: user.username
  });

  redirect("/admin");
}
```

你可以把它拆成：

1. 確保 bootstrap admin 存在
2. 從表單拿 username/password
3. 查 `User`
4. 驗證密碼
5. 寫 session cookie
6. 跳到 `/admin`

實際程式碼還多做了兩件事：

- 檢查 username/password 是否為空
- 檢查 `user.status === "active"`

教學片段為了可讀性有略縮，但這兩個保護條件在真實程式裡是存在的。

## 5. Session 是怎麼做的

檔案：

- `apps/web/lib/auth/session.js`

這裡不是把 session 存到資料庫，而是：

- 用 JSON 做 payload
- 用 `SESSION_SECRET` 做 HMAC 簽章
- 把 token 放到 cookie

而且 session 有效期限是 7 天：

```js
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
```

核心概念：

```text
session payload
-> encode
-> sign with HMAC
-> set cookie
```

## 6. 為什麼這樣能防篡改

因為 cookie 不是只放資料，還放簽章。

如果有人改了 cookie 內容：

- 系統重新驗證簽章時就會失敗
- `decodeSession()` 會回傳 `null`

這不是完整企業級 session system，但對原型階段已經足夠清楚。

另外一個初學者常問的問題是：

既然 payload 只有 base64url 編碼，為什麼不加密？

原因是這個 cookie 內沒有存：

- 密碼
- API key
- 可直接濫用的 secret

它存的是：

- `userId`
- `role`
- `username`
- `expiresAt`

所以這裡主要重點是防篡改，不是防讀取。

## 7. `requireAdminSession()` 是保護後台的關鍵

核心片段：

```js
export async function requireAdminSession() {
  const user = await getSessionUser();

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  return user;
}
```

這段的意思是：

- 先讀 cookie
- 解析 session
- 再去 DB 查使用者是否還有效
- 如果不是 admin，就導回 `/login`

所以「後台保護」不是只看 cookie，而是 cookie + DB 使用者狀態雙重確認。

## 8. `/admin` 首頁在做什麼

檔案：

- `apps/web/app/admin/page.js`

它主要做兩件事：

1. 確認使用者是 admin
2. 查幾個總覽數字

例如：

- providerCount
- targetCount
- deviceCount
- auditCount

所以 `/admin` 頁面本身就像一個簡化 dashboard。

## 9. 管理頁面表單是怎麼寫資料庫的

典型路徑如下：

```text
Page / Form component
-> actions.js
-> requireAdminSession()
-> lib/*.js
-> prisma
-> revalidatePath()
```

### 以 provider 為例

入口：

- `apps/web/app/admin/providers/page.js`
- `apps/web/app/admin/providers/form.js`
- `apps/web/app/admin/providers/actions.js`
- `apps/web/lib/providers.js`

`actions.js` 比較像薄薄的一層：

- 檢查是否登入
- 呼叫 `createProvider()` 或 `updateProvider()`
- `revalidatePath()` 讓頁面刷新資料

真正的業務邏輯是在 `apps/web/lib/providers.js`。

### 以 system 頁為例

入口：

- `apps/web/app/admin/system/page.js`
- `apps/web/app/admin/system/form.js`
- `apps/web/app/admin/system/actions.js`
- `apps/web/lib/system.js`
- `apps/web/lib/runtime-settings.js`

這一頁除了 backup / restore，現在還有一個很實用的後台能力：

- 直接切換 `Runtime logging`

它的特性是：

- 寫進 SQLite
- 不需要重啟 server
- 不需要重新部署
- 開啟後能看到較完整的 Render server logs

這對雲端除錯很重要，因為你可以先維持正式設定，只有在需要排錯時才打開詳細 logs。

## 10. `revalidatePath()` 是什麼

這是 Next.js 的快取更新機制。

你可以把它理解成：

- 表單送出後，資料庫內容已變
- 需要通知 Next.js 重新抓頁面資料

例如：

```js
revalidatePath("/admin");
revalidatePath("/admin/providers");
```

意思就是：

- `/admin`
- `/admin/providers`

下次載入時要重新拿新資料。

## 11. 一張登入到後台的流程圖

```text
User opens /login
    |
    v
login page calls ensureBootstrapAdmin()
    |
    v
submit form
    |
    v
loginAction()
    |
    +--> prisma.user.findUnique()
    +--> verifyPassword()
    +--> createSession()
    |
    v
redirect("/admin")
    |
    v
admin page calls requireAdminSession()
    |
    v
load dashboard data from Prisma
```

## 12. 初學者最該記住的幾個函式

### `ensureBootstrapAdmin()`

用途：

- 確保第一個管理者存在

### `loginAction()`

用途：

- 登入表單處理

### `createSession()`

用途：

- 寫入 session cookie

### `getSessionUser()`

用途：

- 從 cookie 還原出目前登入者

### `requireAdminSession()`

用途：

- 保護管理頁與 server actions
