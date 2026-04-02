# 06. Telegram webhook 主流程

## 1. 這是整個專案最重要的 API

入口檔案：

- `apps/web/app/api/telegram/webhook/route.js`

它負責：

1. 接收 Telegram update
2. 檢查 allowlist
3. dedupe update
4. 過濾非文字訊息
5. 載入 provider
6. 呼叫 LLM 解析
7. 驗證命令是否合法
8. 執行 dispatch
9. 寫 audit log
10. 回 Telegram 訊息

## 2. 簡易流程圖

```text
Telegram update
-> verify webhook secret
-> parse JSON body
-> recordTelegramUpdate (dedupe)
-> check confirm/cancel command
-> findTelegramAccount (allowlist)
-> reject non-text message if needed
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

要注意一個實作細節：

- 如果 `.env` 裡沒有設定 `TELEGRAM_WEBHOOK_SECRET`
- 目前 `verifyTelegramWebhookRequest()` 會直接放行

這在本機開發可能方便，但在公開部署環境不安全，所以正式部署應該一定要設這個值。

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

不過這個專案目前真正支援的是文字訊息。

如果 `message.text` 不存在，route 會回覆類似：

- 目前 MVP 只支援文字訊息

也就是說：

- 貼圖
- 語音
- 圖片 caption 以外的互動型資料

都不會進入後面的 LLM 控制流程。

## 4. 「dedupe」可以直接理解成去重

這個專案裡的 `dedupe`，你可以直接理解成：

- 去重
- 重複過濾

也就是：

- 同一個 Telegram update 不要處理兩次

## 5. dedupe 為什麼重要

函式：

- `recordTelegramUpdate()`

它會把 `update_id` 寫進 `TelegramUpdate` 資料表。

如果同一個 `update_id` 再來一次，就判定為重複，不再重跑整個命令流程。

這很重要，因為 webhook 在現實環境中可能會遇到重送。

## 6. allowlist 怎麼做

函式：

- `findTelegramAccount(telegramUserId)`

如果資料庫裡沒有這個 Telegram user，或狀態不是 `active`：

- 寫 audit log
- 回覆「This Telegram account is not allowed to use this bot.」
- 流程結束

所以 bot 並不是只要知道 webhook URL 就能用。

## 7. confirm / cancel 指令是在什麼時候被辨認

在進入一般 LLM 解析前，route 會先檢查：

```js
const pendingActionCommand = parsePendingActionCommand(message.text);
```

這個函式在 [`apps/web/lib/telegram-utils.mjs`](/home/mimas/projects/mytelebot/apps/web/lib/telegram-utils.mjs) 裡，規則是：

- `confirm TOKEN`
- `cancel TOKEN`

只要訊息符合這個格式，就不會進入 LLM 解析，而是直接走待確認命令流程。

## 8. provider 載入流程

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

## 9. LLM 不是直接亂做事，而是先拿 registry context

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

## 10. `parseCommandWithLlm()` 在做什麼

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

`temperature: 0` 對初學者可以理解成：

- 盡量讓模型回覆更穩定
- 降低隨機性
- 比較適合需要固定 JSON 結構的場景

例如：

- `provider_http_error`
- `provider_timeout`
- `provider_network_error`
- `provider_response_invalid`

這些錯誤最後都會被 webhook route 轉成較容易理解的 operator message。

這裡還有一個小細節：

- provider 的 `baseUrl` 不一定都長一樣
- 系統會自動嘗試 `/v1/chat/completions` 或 `/chat/completions`

所以通常 provider 設定填的是 base URL，不是完整的 chat completions endpoint。

## 11. `intent` 為什麼重要

LLM 回來的內容不一定都是設備控制。

在這個專案目前的 prompt 設計裡，常見 intent 有四種：

- `device_control`
- `device_query`
- `chat`
- `reject`

route 裡會檢查：

```js
const intent = String(parsed.intent || "reject");

if (intent !== "device_control") {
  // 不進行設備控制
}
```

也就是說：

- 只有 `device_control` 才會進入真正控制流程
- `device_query`、`chat`、`reject` 都不會 dispatch
- 這些非控制型 intent 只會回安全的文字說明

## 12. `validateLlmActions()` 是安全核心

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

另外它還有兩個容易忽略的細節：

### A. 跨 target 的裝置推斷

如果 LLM 給的 `target_key` 錯了，但 `device_key` 在所有 active target 中剛好只匹配到一台裝置，系統會自動推斷正確的 target。

如果匹配到多台，就不會自動推斷。

### B. 從自然語言補參數

如果某個 command 的 `argsSchemaJson` 裡有像 `state: ON/OFF` 這種欄位，而使用者原文有「打開」、「關閉」等字眼，系統會嘗試自動補上 `args.state`。

這樣使用者不用每次都說得像 JSON 一樣精確。

## 13. 為什麼還要檢查「原始文字是否明確提到設備」

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

## 14. cooldown 與 confirmation

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

你也可以把這段理解成：

```text
一般訊息 -> 走 LLM parse
confirm/cancel 訊息 -> 直接走 pending action 處理
```

## 15. dispatch 真正做什麼

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

## 16. 這條流程會寫哪些紀錄

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

## 17. 第一次打開 `route.js` 應該怎麼讀

[`apps/web/app/api/telegram/webhook/route.js`](/home/mimas/projects/mytelebot/apps/web/app/api/telegram/webhook/route.js) 是專案最大的單一檔案之一。

第一次讀時不要從最上面一路硬啃。

比較好的讀法是：

1. 先找到最下面的 `export async function POST(request)`
2. 先理解主流程
3. 再往上回看輔助函式

因為這個檔案前半部主要是：

- 錯誤分類 helper
- Telegram reply 格式化 helper
- confirmation / cooldown 的訊息組裝 helper
- `dispatchActionFlow()` 這種子流程函式

真正的主入口還是 `POST(request)`。

## 18. 最值得初學者細讀的函式

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
