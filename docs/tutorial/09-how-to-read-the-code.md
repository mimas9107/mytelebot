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

如果看到這種寫法：

```js
import "@/lib/server-env";
```

這叫做 side-effect import。

意思是：

- 不是要拿某個函式來用
- 而是要先執行該模組的初始化邏輯

在這個專案裡，通常是為了先載入 `.env`。

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

### 想確認自己有沒有改壞核心流程

這個專案其實有一批測試腳本放在 `scripts/`。

最常用的入口是根目錄 [`package.json`](/home/mimas/projects/mytelebot/package.json) 這些 script：

- `npm run test:core`
- `npm run test:unit:llm`
- `npm run test:unit:registry`
- `npm run test:unit:dispatcher`
- `npm run test:unit:telegram`
- `npm run test:integration:message-flow`
- `npm run test:integration:webhook`

如果你改了 `lib/*` 的核心邏輯，至少跑一次：

```bash
npm run test:core
```

`test:core` 不是單一測試檔，而是一個整合入口。
目前它會把幾類核心測試一起跑起來，例如：

- `test:contract:payload`
- `test:fixtures:alias`
- 各個 `test:unit:*`

如果你要產出報告型結果，root `package.json` 也還有：

- `npm run test:report:core`
- `npm run test:report:message-flow`

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

## 8. 速查表

```text
概念                 | 主要檔案
bootstrap admin      | apps/web/lib/auth/bootstrap.js
session cookie       | apps/web/lib/auth/session.js
password hash        | apps/web/lib/password.js
secret encryption    | apps/web/lib/encryption.js
Prisma client        | apps/web/lib/prisma.js
Prisma schema        | prisma/schema.prisma
LLM parse            | apps/web/lib/llm.js
LLM helper           | apps/web/lib/llm-utils.mjs
registry validation  | apps/web/lib/registry.js
registry helpers     | apps/web/lib/registry-utils.mjs
device dispatch      | apps/web/lib/dispatcher.js
dispatch helpers     | apps/web/lib/dispatcher-utils.mjs
Telegram helper      | apps/web/lib/telegram.js
Telegram utils       | apps/web/lib/telegram-utils.mjs
system backup/metrics| apps/web/lib/system.js
```
