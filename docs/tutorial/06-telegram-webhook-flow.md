# 06. Telegram webhook 主流程

## 1. 這是整個專案最重要的 API

入口檔案：

- `apps/web/app/api/telegram/webhook/route.js`

它負責：

1. 接收 Telegram update
2. 檢查 allowlist
3. dedupe update
4. 載入 provider
5. 呼叫 LLM 解析
6. 驗證命令是否合法
7. 執行 dispatch
8. 寫 audit log
9. 回 Telegram 訊息

## 2. 簡易流程圖

```text
Telegram update
-> verify webhook secret
-> parse JSON body
-> recordTelegramUpdate (dedupe)
-> findTelegramAccount (allowlist)
-> createTelegramAuditLog("received")
-> getActiveProvider()
-> buildLlmRegistryContext()
-> parseCommandWithLlm()
-> validateLlmActions()
-> checkCommandCooldown()
-> maybe createPendingTelegramAction()
-> dispatchValidatedAction()
-> recordCommandExecution()
-> sendTelegramMessage()
```

## 3. webhook 一開始先做什麼

一進 route，先做三件事：

### A. 驗證 secret token

函式：

- `verifyTelegramWebhookRequest(request)`

這個會檢查 header：

- `x-telegram-bot-api-secret-token`

### B. 解析 request body

如果不是合法 JSON，就回 400。

### C. 抓出 Telegram message

route 裡有：

```js
function extractMessage(update) {
  return update.message || update.edited_message || update.channel_post || null;
}
```

代表它接受多種 Telegram update 型態，但最後只抓出主要訊息物件。

## 4. dedupe 為什麼重要

函式：

- `recordTelegramUpdate()`

它會把 `update_id` 寫進 `TelegramUpdate` 資料表。

如果同一個 `update_id` 再來一次，就判定為重複，不再重跑整個命令流程。

這很重要，因為 webhook 在現實環境中可能會遇到重送。

## 5. allowlist 怎麼做

函式：

- `findTelegramAccount(telegramUserId)`

如果資料庫裡沒有這個 Telegram user，或狀態不是 `active`：

- 寫 audit log
- 回覆「This Telegram account is not allowed to use this bot.」
- 流程結束

所以 bot 並不是只要知道 webhook URL 就能用。

## 6. provider 載入流程

函式：

- `getActiveProvider()`

檔案：

- `apps/web/lib/llm.js`

它會先找：

1. `isDefault = true` 且 `status = active`
2. 如果沒有，再找任一個 active provider

回傳內容包含：

- `baseUrl`
- `model`
- `capabilities`
- `extraHeaders`
- 解密後的 `apiKey`

## 7. LLM 不是直接亂做事，而是先拿 registry context

函式：

- `buildLlmRegistryContext()`

檔案：

- `apps/web/lib/registry.js`

它會把目前 active 的：

- targets
- devices
- commands

組成一份給 LLM 的上下文。

這個上下文大概長這樣：

```text
available_targets
  -> target_key
  -> devices
       -> device_key
       -> aliases
       -> commands
            -> command_key
            -> aliases
            -> args_schema_json
```

這代表 LLM 不是在真空中猜，而是根據伺服器提供的白名單來回答。

## 8. `parseCommandWithLlm()` 在做什麼

檔案：

- `apps/web/lib/llm.js`

核心概念：

```text
user message + registry context
-> build prompt
-> POST 到 provider
-> 取回 JSON
-> parse JSON
```

重點：

- `temperature: 0`
- 可選 `response_format: { type: "json_object" }`
- 解析失敗會丟出特定 error code

例如：

- `provider_http_error`
- `provider_timeout`
- `provider_network_error`
- `provider_response_invalid`

這些錯誤最後都會被 webhook route 轉成較容易理解的 operator message。

## 9. `intent` 為什麼重要

LLM 回來的內容不一定都是設備控制。

route 裡會檢查：

```js
const intent = String(parsed.intent || "reject");

if (intent !== "device_control") {
  // 不進行設備控制
}
```

也就是說：

- 只有 `device_control` 才會進入真正控制流程
- 否則只回安全的說明訊息

## 10. `validateLlmActions()` 是安全核心

檔案：

- `apps/web/lib/registry.js`

這個函式非常關鍵。

它不是只看 LLM 給的字串，而是實際檢查：

1. `target_key` 是否存在
2. `device_key` 是否存在
3. `command_key` 是否存在
4. 原始文字是否明確提到該設備
5. `args` 是否符合該 command 的 schema

這裡最重要的觀念是：

LLM 說可以，不代表系統就相信。

## 11. 為什麼還要檢查「原始文字是否明確提到設備」

這是為了避免 LLM 幻覺亂配對。

也就是說，即使 LLM 回：

```json
{
  "device_key": "living-room-ac"
}
```

如果使用者原文根本沒明確提到這台設備或其 alias，
後端仍然會拒絕。

這個設計比單純「LLM JSON schema 正確」更安全。

## 12. cooldown 與 confirmation

### cooldown

函式：

- `checkCommandCooldown(command.id)`

用途：

- 避免某些命令短時間內重複執行

### confirmation

如果命令需要確認：

- 先建立 `PendingTelegramAction`
- 回覆使用者 `confirm TOKEN` 或 `cancel TOKEN`
- 等下一則 Telegram 訊息進來再處理

這就是高風險命令的二段式流程。

## 13. dispatch 真正做什麼

函式：

- `dispatchValidatedAction(action)`

檔案：

- `apps/web/lib/dispatcher.js`

它會：

1. 根據 command 的 `path`、`method`、`payloadTemplateJson` 組請求
2. 根據 target 的 `authType` 套用認證
3. 用 `fetch()` 呼叫真正的 target API
4. 回傳標準化結果

所以真正對外打設備 API 的地方不是 webhook route，而是 dispatcher。

## 14. 這條流程會寫哪些紀錄

### `AuditLog`

用來記錄：

- received
- provider_missing
- parse failed
- validation failed
- dispatch success/failure

### `CommandExecution`

用來記錄：

- command 被成功或失敗執行
- 給 cooldown 使用

### `TelegramUpdate`

用來記錄：

- `update_id`
- 避免重複處理

### `PendingTelegramAction`

用來記錄：

- 待確認命令

## 15. 最值得初學者細讀的函式

### `POST(request)` in webhook route

這是總控流程。

### `recordTelegramUpdate()`

理解 dedupe。

### `getActiveProvider()`

理解 provider 選擇。

### `parseCommandWithLlm()`

理解 LLM 呼叫方式。

### `validateLlmActions()`

理解安全白名單驗證。

### `dispatchValidatedAction()`

理解實際 HTTP dispatch。
