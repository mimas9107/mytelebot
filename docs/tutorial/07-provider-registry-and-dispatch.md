# 07. Provider、Registry、Dispatcher 三大核心

## 1. 為什麼這三個模組要分開

它們三個分別回答不同問題：

- `Provider`：要找哪個 LLM 來解析
- `Registry`：這個命令是否合法、對應哪台設備
- `Dispatcher`：怎麼真的把命令送出去

如果不分開，所有責任會混在 webhook route 裡，很難維護。

## 2. Provider 模組在做什麼

檔案：

- `apps/web/lib/providers.js`
- `apps/web/lib/llm.js`

### `providers.js`

偏向管理面：

- create/update provider
- rotate API key
- set default
- test connection

另外，provider 紀錄裡的 `capabilitiesJson` 不是隨便一包 JSON。
目前比較重要的欄位有：

- `capability_profile`
- `json_output_mode`
- `json_strict`

它們會影響 `parseCommandWithLlm()` 組 request 的方式。

例如：

- 要不要要求 provider 回 JSON object
- JSON 規則要不要更嚴格
- 這個 provider 比較接近哪一種能力輪廓

### `llm.js`

偏向執行面：

- get active provider
- call provider API
- parse JSON result

呼叫 provider 時還有一個實用的小容錯：

- 如果 `baseUrl` 已經以 `/v1` 結尾，就直接接 `/chat/completions`
- 否則會依序嘗試：
  - `/v1/chat/completions`
  - `/chat/completions`

所以通常不用把完整 endpoint path 寫進 provider 設定。

## 3. `createProvider()` 是典型的管理邏輯

它會做的事：

1. 從表單讀資料
2. 解析 JSON 輸入欄位
3. 如果有 API key，先加密並寫進 `Secret`
4. 再建立 `LlmProvider`
5. 必要時把其他 provider 的 `isDefault` 清掉

這是一個很典型的 pattern：

```text
formData
-> normalize / validate
-> transaction
-> write multiple related tables
```

## 4. `rotateProviderApiKey()` 為什麼值得注意

這個函式沒有直接覆蓋舊 secret，而是：

1. 建一筆新 `Secret`
2. 把舊 secret 標記 `rotatedAt`
3. 更新 `LlmProvider.apiKeySecretId`
4. 寫 `AuditLog`

這代表專案作者希望保留 rotation history，而不是直接覆蓋。

這是個不錯的實務設計。

## 5. Registry 模組在做什麼

檔案：

- `apps/web/lib/registry.js`
- `apps/web/lib/registry-utils.mjs`

它主要負責兩類事情：

### A. 管理端 CRUD

例如：

- createTarget
- createDevice
- createDeviceCommand
- updateTarget
- dryRunCommand
- testTargetConnection

### B. 執行期安全驗證

例如：

- `buildLlmRegistryContext()`
- `validateLlmActions()`
- `hydrateValidatedAction()`
- `checkCommandCooldown()`

## 6. `buildLlmRegistryContext()` 的角色

它會把 active targets / devices / commands 組裝成給 LLM 的上下文。

這樣 LLM 看到的是一份「受控的功能表」，不是整個世界。

這個設計很重要，因為它讓 prompt 更接近：

```text
請在這些已註冊裝置與命令中做選擇
```

而不是：

```text
請自由想像可用的設備
```

## 7. `validateLlmActions()` 為什麼是核心安全閘門

這個函式會檢查：

- target 是否存在
- device 是否存在
- command 是否存在
- 原始文字是否真的提到該設備
- args 是否符合 schema

如果任何一步失敗，就不 dispatch。

另外還有一個容錯設計：

- 如果 `target_key` 解析錯了
- 但 `device_key` 在所有 active target 中剛好只命中一台裝置

系統會跨 target 幫你推斷出正確 target。

但如果有多台裝置都可能符合，就不會自動推斷。

這個模組是把「LLM 輸出」轉成「系統可接受的受控命令」的地方。

## 8. Dispatcher 模組在做什麼

檔案：

- `apps/web/lib/dispatcher.js`
- `apps/web/lib/dispatcher-utils.mjs`

它做的事可以拆成兩步：

### A. render request

函式：

- `renderValidatedAction(action)`

它會：

- 讀 target
- 套 auth
- 用 payload template + args 產生實際 payload
- 同時產生 masked request 供紀錄用

這裡的 masked request，可以先理解成：

- 真正送出的 request 裡有敏感資訊
- 但寫 log 或顯示時，會把 secret 改成 `***`

### B. execute request

函式：

- `dispatchValidatedAction(action)`

它會：

- 發 HTTP request
- 處理 timeout/network/http/business error
- 回傳標準格式結果

## 9. `authType` 在 dispatcher 的作用

target 目前支援：

- `none`
- `bearer`
- `header`
- `query`
- `hmac`

在 `applyAuth()` 裡會依不同類型把認證資訊套到 request 上。

如果你第一次看到 `HMAC`，可以先把它理解成：

- 用密鑰對請求內容做簽章
- 讓對方知道這段請求沒有被偷偷改掉

這一段很值得學，因為它把「同一種設備 dispatch 流程」和「不同認證機制」拆開了。

## 10. payload template 是什麼

你可以把它理解成：

- command 定義一個可控的 payload 模板
- 使用者輸入只負責補參數

例如 command 設定：

```json
{
  "temperature": "{{temperature}}"
}
```

當使用者說「調到 25 度」時，dispatcher 才會產生：

```json
{
  "temperature": 25
}
```

這樣做的好處是：

- payload 結構由後端掌控
- LLM 不會自由定義整個 JSON 結構

再補一個小細節：

- 如果 template value 完全就是 `{{temperature}}`
  - 替換時會盡量保留原始型別，例如數字仍然是數字
- 如果 template value 是 `set {{temperature}} degrees`
  - 替換時就會變成字串

## 11. 一條完整的資料傳遞鏈

```text
Admin creates target/device/command in UI
-> data stored in SQLite

Telegram message arrives
-> registry context built from SQLite
-> LLM returns action keys
-> registry validates keys and args
-> dispatcher renders HTTP request
-> target API called
-> audit and execution logs written to SQLite
```

## 12. 專案中最重要的函式片段講述

### `getActiveProvider()`

用途：

- 找出當前應該使用哪個 provider

它的重要性在於：

- 後續 parse 流程全靠它
- 也把加密 secret 轉回可用 API key

### `buildLlmRegistryContext()`

用途：

- 把白名單資料組成 prompt context

它的重要性在於：

- 把資料庫內容轉成 LLM 能理解的輸入

### `validateLlmActions()`

用途：

- 把 LLM 輸出重新驗證成安全命令

它的重要性在於：

- 這是「AI 可用」與「AI 可控」之間的界線

### `renderValidatedAction()`

用途：

- 產出實際 request 細節

它的重要性在於：

- 真正把 command 定義轉為 HTTP request

### `dispatchValidatedAction()`

用途：

- 執行 request 並收斂錯誤型別

它的重要性在於：

- 這裡把 target API 的錯誤整理成上層可理解的形式

## 13. 初學者讀這三個模組的順序

建議順序：

1. `apps/web/lib/llm.js`
2. `apps/web/lib/registry.js`
3. `apps/web/lib/dispatcher.js`

原因：

- 先知道 LLM 怎麼輸入輸出
- 再知道白名單怎麼驗證
- 最後知道 HTTP request 怎麼送出去
