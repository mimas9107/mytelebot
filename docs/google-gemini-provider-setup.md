# Google Gemini Provider 設定指南

這份文件是給「已經登入 MyTeleBot 管理後台，現在想把 `Google Gemini Flash` 設成 provider」的人用的。

## 1. 先講結論

如果你在 Google AI Studio 取得了 Gemini API key，不要直接照原生 Gemini 的 `generateContent` 範例去填 MyTeleBot 的 provider。

原因是：

- 你現在這個專案的 provider 呼叫介面是 OpenAI-style `chat/completions`
- 不是 Gemini 原生的 `models/...:generateContent`

本專案目前的 LLM 呼叫實作可參考：

- [`apps/web/lib/llm.js`](/home/mimas/projects/mytelebot/apps/web/lib/llm.js)
- [`apps/web/lib/llm-utils.mjs`](/home/mimas/projects/mytelebot/apps/web/lib/llm-utils.mjs)

Google 官方目前有提供 Gemini 的 OpenAI compatibility endpoint，所以可以直接接進這個專案。

官方文件：

- https://ai.google.dev/gemini-api/docs/openai

## 2. 你貼的 curl 為什麼不能直接用

你在 AI Studio 看到的原生範例大概像這樣：

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent" \
  -H 'Content-Type: application/json' \
  -H 'X-goog-api-key: YOUR_GEMINI_API_KEY' \
  -X POST \
  -d '{ ... }'
```

這種寫法的特徵是：

- endpoint 是 `...:generateContent`
- API key 放在 `X-goog-api-key`
- request body 是 Gemini 原生格式 `contents/parts`

但 MyTeleBot 目前送給 provider 的格式是：

- endpoint 走 `/chat/completions`
- API key 預設走 `Authorization: Bearer ...`
- request body 是 OpenAI-style `model/messages`

所以你要用的是 Gemini 官方提供的 OpenAI compatibility 入口，而不是原生 `generateContent`。

## 3. 正確的對應方式

Google 官方 OpenAI compatibility 的 REST 範例是：

```bash
curl "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer GEMINI_API_KEY" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Explain to me how AI works"
      }
    ]
  }'
```

這和 MyTeleBot 目前的 provider 呼叫方式是一致的。

## 4. 在 MyTeleBot 後台應該怎麼填

進入：

- `/admin/providers`

建立 provider 時，建議先這樣填：

### 基本欄位

- `Provider key`: `google-gemini-flash`
- `Name`: `Google Gemini Flash`
- `Base URL`: `https://generativelanguage.googleapis.com/v1beta/openai`
- `Model`: `gemini-2.5-flash`
- `API key`: 你的 Gemini API key

### 進階欄位

- `Extra headers JSON`: 留空
- `Capability profile`: `OpenAI-compatible`
- `JSON output mode`: `response_format=json_object`
- `Require strict JSON-only output`: 勾選
- `Capabilities JSON`: 留空
- `Set as active default provider`: 勾選

## 5. 為什麼這樣填

### `Base URL`

本專案會自動把 `baseUrl` 補成：

- `/v1/chat/completions`
- 或 `/chat/completions`

Gemini OpenAI compatibility 的正確 base URL 應該是：

```text
https://generativelanguage.googleapis.com/v1beta/openai
```

這樣專案最後會打到：

```text
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

### `Model`

建議先填：

```text
gemini-2.5-flash
```

原因是：

- 官方文件明確示範這個 model
- 比 `gemini-flash-latest` 這種浮動名稱更穩定
- 之後如果你想升版，再手動改 model 即可

### `API key`

這個專案建立 provider 時，會把 API key 加密後存進 `Secret` 表，不是把明文直接放在 `LlmProvider` 表。

可參考：

- [`apps/web/lib/providers.js`](/home/mimas/projects/mytelebot/apps/web/lib/providers.js)
- [`apps/web/lib/encryption.js`](/home/mimas/projects/mytelebot/apps/web/lib/encryption.js)

### `Extra headers JSON`

對 Gemini 這個設定先留空即可。

因為這個專案本來就會自動加：

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

你不需要手動再填：

```json
{"X-goog-api-key":"..."}
```

### `JSON output mode`

建議先選：

```text
response_format=json_object
```

因為這個專案的主要用途不是聊天，而是要把自然語言轉成結構化 JSON 命令。

如果 provider 能接受 `response_format: { type: "json_object" }`，輸出通常會更穩。

### `Require strict JSON-only output`

建議勾選。

因為 webhook 命令解析最怕模型多講廢話、前後夾雜說明文字。

勾選後，系統 prompt 會更強調：

- 只回 JSON
- 不要回 markdown
- 不要回多餘說明

## 6. 建立後怎麼驗證

建立完成後，建議按這個順序檢查：

1. `Create provider`
2. `Test connection`
3. 確認它是 `active` 且 `default`

### `Test connection` 實際做什麼

目前系統的 provider 測試會去打：

- `${baseUrl}/v1/models`
- 或 `${baseUrl}/models`

對 Gemini 這個設定來說，實際上會對應到：

```text
https://generativelanguage.googleapis.com/v1beta/openai/models
```

Google 官方 OpenAI compatibility 文件也有列出這個 models endpoint，所以理論上可通。

## 7. 如果測試失敗，先檢查哪幾點

### 情況 A：401 / 403

通常代表：

- API key 無效
- API key 貼錯
- API key 已撤銷

### 情況 B：404

通常代表：

- `Base URL` 填錯
- 你把完整 `/chat/completions` 也填進 `Base URL` 了

正確是：

```text
https://generativelanguage.googleapis.com/v1beta/openai
```

不是：

```text
https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
```

### 情況 C：provider 測試成功，但 webhook 解析輸出怪怪的

可以先把：

- `JSON output mode`

改成：

```text
prompt_only
```

有些相容端點雖然支援 OpenAI-style API，但對 `response_format=json_object` 的相容程度可能和原生 OpenAI 不完全一致。

## 8. 一組建議的實際設定

你可以直接照下面這組填：

```text
Provider key: google-gemini-flash
Name: Google Gemini Flash
Base URL: https://generativelanguage.googleapis.com/v1beta/openai
Model: gemini-2.5-flash
API key: <你的 Gemini API key>
Extra headers JSON:
Capability profile: openai_compatible
JSON output mode: json_object

## 9. 免費 API key 大概夠用嗎

對「家庭自用」這種規模來說，通常夠。

先講結論：

- 如果你只是用 Telegram 傳日常家電控制指令
- 例如開燈、關燈、開冷氣、調整溫度、啟動電鍋

那麼 `Gemini 2.5 Flash` 的免費 API key，通常不是先被 token 用量打爆，而是先碰到 request 數量限制。

### 為什麼

本專案每次 webhook 命令解析，大致只會做一次 LLM request。

prompt 內容主要包含：

1. 固定的 parser 指令
2. 目前 registry 中的 target / device / command 白名單
3. 使用者當次 Telegram 訊息

這段邏輯可以參考：

- [`apps/web/lib/llm-utils.mjs`](/home/mimas/projects/mytelebot/apps/web/lib/llm-utils.mjs)
- [`apps/web/lib/registry.js`](/home/mimas/projects/mytelebot/apps/web/lib/registry.js)

### 以家庭自用情境粗估

假設你家裡未來有：

- 客廳冷氣
- 客廳落地燈
- 臥室燈
- 臥室電風扇
- 廚房電鍋

而且每台設備大概有 2 到 4 個命令。

那在這種規模下，單次 Telegram webhook 大概可以先粗估為：

- input tokens：約 `350 ~ 900`
- output tokens：約 `50 ~ 150`
- 單次總量：約 `500 ~ 1,000`

保守一點，直接把它當成：

- **每次控制命令約 1,000 tokens**

### 一天大概會花多少

如果你一天的操作像這樣：

- 出門前關燈、關冷氣、關風扇
- 回家前開冷氣、開電鍋
- 到家開客廳燈
- 晚上再調幾次冷氣
- 睡前把燈、風扇、冷氣關掉

這種家庭使用量，大概很容易落在：

- `10 ~ 20` 次 Telegram 指令 / 天

那 token 用量大概會是：

- `10 次 * 1,000 tokens = 10,000 tokens/day`
- `20 次 * 1,000 tokens = 20,000 tokens/day`

對家庭自用來說，這通常還算很輕。

### 真正比較容易先撞到什麼

在這個專案目前規模下，通常先碰到的比較像是：

- 每分鐘 request 上限
- 每日 request 上限

而不是 token 本身。

也就是說：

- 如果你只是自用、一天十幾次控制
- 通常不用太擔心 token 爆掉

### 什麼情況 token 會開始變重要

以下情況會讓單次 prompt 膨脹：

- target / device / command 越來越多
- alias 設得很多
- 你把很多普通聊天也一起送到同一個 provider
- 你希望 LLM 同時做更複雜的自然語言理解

到那時候，單次 webhook 的 token 才會明顯上升。

### 實務建議

如果你現在只是：

- 一個家庭
- 幾台家電
- Telegram 控制為主

那麼可以先放心使用 `Gemini 2.5 Flash` 免費 key 做原型驗證。

你更該優先注意的，通常不是 token，而是：

- target API 穩定性
- Render free instance 是否會被回收
- SQLite 資料是否持久化
- command schema / confirmation / cooldown 是否設合理
Require strict JSON-only output: on
Capabilities JSON:
Set as active default provider: on
```

如果你想用比較保守的模式，則改成：

```text
JSON output mode: prompt_only
```

## 9. 安全提醒

如果你曾經把 Gemini API key 貼到聊天訊息、螢幕截圖、commit、文件或 issue 裡，請直接：

1. 到 Google AI Studio 旋轉或刪除那把 key
2. 建一把新的
3. 回到 `/admin/providers`
4. 使用 `Rotate API key` 更新

不要再繼續使用已外露的 key。

## 10. 給這個專案的最終建議

對 MyTeleBot 目前的 provider 架構來說，Gemini 最穩定的接法不是原生 `generateContent`，而是：

- Gemini OpenAI compatibility endpoint
- `Authorization: Bearer ...`
- `gemini-2.5-flash`

這樣和目前專案的 `/chat/completions` 設計最吻合，也最少需要改程式碼。
