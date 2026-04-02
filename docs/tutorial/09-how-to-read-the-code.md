# 09. 初學者怎麼讀這個專案程式碼

## 1. 不要一開始就逐檔硬讀

這個專案雖然不算巨大，但如果你從 `apps/web/lib/registry.js` 第一行開始硬讀到最後，很容易失去方向。

建議改成「以問題帶路」：

- 我想知道登入怎麼做？
- 我想知道 Telegram 訊息怎麼被處理？
- 我想知道 provider 資料怎麼存？
- 我想知道設備命令怎麼送出去？

然後再從入口往裡讀。

## 2. 建議的第一輪閱讀順序

### 第一天版本

1. `prisma/schema.prisma`
2. `apps/web/app/page.js`
3. `apps/web/app/login/page.js`
4. `apps/web/app/login/actions.js`
5. `apps/web/lib/auth/bootstrap.js`
6. `apps/web/lib/auth/session.js`

目標：

- 看懂登入與資料表基礎

### 第二天版本

1. `apps/web/app/admin/providers/page.js`
2. `apps/web/app/admin/providers/actions.js`
3. `apps/web/lib/providers.js`

目標：

- 看懂管理頁表單如何進資料庫

### 第三天版本

1. `apps/web/app/api/telegram/webhook/route.js`
2. `apps/web/lib/telegram.js`
3. `apps/web/lib/llm.js`
4. `apps/web/lib/registry.js`
5. `apps/web/lib/dispatcher.js`

目標：

- 看懂 bot 主流程

## 3. 一個很實用的閱讀技巧

### 技巧 A：先看 import

例如看到：

```js
import { getActiveProvider, parseCommandWithLlm } from "@/lib/llm";
import { dispatchValidatedAction } from "@/lib/dispatcher";
```

你就知道這個檔案的責任只是協調流程，不是把所有細節都寫在裡面。

### 技巧 B：先找 return shape

很多函式看起來很長，但你可以先找：

- 回傳物件長什麼樣
- 失敗時回什麼
- 成功時回什麼

這比一開始糾結每個 `if` 更容易掌握設計。

### 技巧 C：先看資料模型再看邏輯

像 `PendingTelegramAction`、`CommandExecution` 這種名字，先去 `schema.prisma` 看欄位，再回來看 route，就會比較好懂。

## 4. 你可以用這些問題檢查自己有沒有看懂

### 關於登入

- bootstrap admin 是什麼？
- session cookie 存了什麼？
- 為什麼要查 DB 才確認使用者狀態？

### 關於 provider

- provider 的 API key 為什麼不直接存明文？
- 預設 provider 如何決定？
- 測試連線怎麼做？

### 關於 webhook

- dedupe 是在哪裡做的？
- allowlist 是在哪裡做的？
- LLM 解析失敗後怎麼回訊息？
- validation 失敗在哪一層擋下來？

### 關於 dispatch

- target auth type 有哪些？
- payload template 怎麼套參數？
- 哪裡會寫 command execution？

## 5. 如果你要自己繼續擴充，先抓哪些點

### 想加新管理功能

照這個 pattern：

```text
page.js
-> form.js
-> actions.js
-> lib/*.js
-> prisma
```

### 想加新 API

照這個 pattern：

```text
app/api/.../route.js
-> import lib function
-> validate input
-> call lib
-> return JSON
```

### 想加新資料表

照這個 pattern：

```text
update schema.prisma
-> create migration
-> update lib service
-> update page/action if needed
```

## 6. 目前最值得重構但初學者先不用急著動的地方

這些不是錯，而是目前仍偏單體、原型化：

- `apps/web/lib/registry.js` 功能很多，之後可再拆
- `apps/web/app/api/telegram/webhook/route.js` 流程長，之後可再切成 orchestration functions
- `apps/web/lib/system.js` 同時處理檔案與 audit log，未來可再抽層
- `apps/web/lib/*` 目前還沒有獨立 `packages/*` 分模組

但對初學者來說，這反而有好處：

- 邏輯集中
- 容易從入口一路追到資料庫

## 7. 最後的閱讀建議

不要追求一次看懂全部。

比較好的方式是每次只選一條完整流程：

### 流程 1：登入

```text
/login
-> loginAction
-> session
-> /admin
```

### 流程 2：新增 provider

```text
/admin/providers
-> createProviderAction
-> createProvider
-> secret + llmProvider
```

### 流程 3：Telegram 控制命令

```text
/api/telegram/webhook
-> llm
-> registry validation
-> dispatcher
-> audit
```

只要你能分別把這三條流程講清楚，對這個專案就已經不是「只看得懂表面」了。
