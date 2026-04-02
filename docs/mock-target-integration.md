# MyTeleBot 串接 Mock Target 設定指南

這份文件說明：

- `mock-target/` 跑起來之後
- 要怎麼在 MyTeleBot 後台建立第一組 `Target / Device / Command`
- 讓 Telegram 指令真的打到這個 mock target

適合你目前這個階段：

- provider 已設定好
- admin 已可登入
- 想先把 target 鏈路跑通
- 暫時還沒有正式對外暴露的家庭 API

## 1. 先講整條鏈路

你接下來要建立的是這一段：

```text
Telegram
-> MyTeleBot webhook
-> LLM provider
-> registry validate
-> target dispatch
-> mock-target
```

其中你現在要手動建立的是：

1. `Target`
2. `Device`
3. `Command`

## 2. 建議先用最簡單的模式開始

第一輪建議先不要一開始就開：

- `header`
- `query`
- `hmac`

而是先用：

- `Auth type = none`

原因很實際：

- 先確認 URL / method / path / payloadTemplate 都對
- 減少一開始就卡在 auth mismatch
- 等基本鏈路通了，再切到 `bearer` 或 `hmac`

## 3. 假設你的 mock-target 已部署在這裡

例如：

```text
https://mytelebot-mock-target.onrender.com
```

那你在 MyTeleBot 後台就可以開始建第一組 target。

## 4. Target 應該怎麼填

進入：

- `/admin/registry`

在 `Create target` 先填這組：

### 建議值

- `Target key`: `render-mock-target`
- `Name`: `Render Mock Target`
- `Base URL`: `https://mytelebot-mock-target.onrender.com`
- `Auth type`: `none`
- `Timeout (ms)`: `8000`
- `Auth secret`: 留空

### 為什麼這樣填

#### `Base URL`

這個值是 dispatcher 的 base URL。

之後 command 的 `path` 會和它組合起來。

例如：

- `Base URL = https://mytelebot-mock-target.onrender.com`
- `Command path = /device/living-room-ac/set-temperature`

實際 dispatch 就會打到：

```text
https://mytelebot-mock-target.onrender.com/device/living-room-ac/set-temperature
```

#### `Auth type = none`

因為 `mock-target` 已支援多種 auth，但第一輪建議先專注驗證：

- path
- method
- payload
- response handling

## 5. 建完 Target 先做什麼

先按：

- `Test target connection`

這一步會優先打：

- `GET <baseUrl>/health`

如果成功，你應該會在 MyTeleBot 後台看到類似：

- `Connected successfully at https://mytelebot-mock-target.onrender.com/health`

如果這一步就失敗，先不要繼續建 device/command，先處理：

- Render service 是否真的 alive
- `Base URL` 是否正確
- mock-target 是否成功部署

## 6. Device 應該怎麼填

在 `Create device` 先建一台最簡單、最容易辨識的假設備。

### 建議值

- `Device key`: `living-room-ac`
- `Name`: `客廳冷氣`
- `Target`: 選 `Render Mock Target`
- `Type`: `air_conditioner`
- `Description`: `Render mock target test device`
- `Aliases JSON`:

```json
["冷氣","客廳冷氣","aircon","ac"]
```

### 為什麼要先填 aliases

因為這個專案的 LLM 驗證不是只靠 `deviceKey`。

使用者之後可能會說：

- `打開客廳冷氣`
- `把冷氣調到 25 度`

有 aliases，LLM 與 registry 才比較容易對到這台設備。

## 7. 第一個 Command 建議怎麼做

建議不要一開始就做太複雜的 command。

第一個 command 最好是：

- `POST`
- path 清楚
- payload 規則簡單
- args schema 也簡單

### 範例 A：開關命令

#### 建議值

- `Command key`: `set_power`
- `Label`: `設定電源`
- `Device`: `客廳冷氣 (living-room-ac)`
- `Method`: `POST`
- `Path`: `/device/living-room-ac/power`
- `Aliases JSON`:

```json
["開機","關機","打開","關閉","power"]
```

- `Payload template JSON`:

```json
{
  "state": "{{state}}"
}
```

- `Args schema JSON`:

```json
{
  "type": "object",
  "properties": {
    "state": {
      "type": "string",
      "enum": ["ON", "OFF"]
    }
  },
  "required": ["state"]
}
```

- `Confirmation required`: 不勾
- `Cooldown seconds`: `0`

### 為什麼這個 command 適合當第一個

因為：

- `state` 只有 `ON/OFF`
- MyTeleBot 現在已有自然語言補參數邏輯
- 使用者說「打開」、「關閉」時，系統有機會自動補出 `state`

## 8. 第二個 Command 可以做溫度設定

### 範例 B：設定溫度

#### 建議值

- `Command key`: `set_temperature`
- `Label`: `設定溫度`
- `Device`: `客廳冷氣 (living-room-ac)`
- `Method`: `POST`
- `Path`: `/device/living-room-ac/set-temperature`
- `Aliases JSON`:

```json
["調溫","設定溫度","溫度","temperature"]
```

- `Payload template JSON`:

```json
{
  "temperature": "{{temperature}}"
}
```

- `Args schema JSON`:

```json
{
  "type": "object",
  "properties": {
    "temperature": {
      "type": "number",
      "minimum": 18,
      "maximum": 30
    }
  },
  "required": ["temperature"]
}
```

- `Confirmation required`: 不勾
- `Cooldown seconds`: `0`

## 9. 建完 Command 後一定先做 dry run

在 MyTeleBot 後台，對剛建好的 command 先做：

- `Dry run`

### 例子 A：電源

對 `set_power` 測：

```json
{"state":"ON"}
```

你應該看到類似：

```json
{
  "method": "POST",
  "url": "https://mytelebot-mock-target.onrender.com/device/living-room-ac/power",
  "headers": {
    "Content-Type": "application/json"
  },
  "payload": {
    "state": "ON"
  }
}
```

### 例子 B：溫度

對 `set_temperature` 測：

```json
{"temperature":25}
```

這一步的目的不是打出去，而是先確認：

- URL 是不是你預期的
- method 對不對
- payload template 套值對不對

## 10. 真正打到 mock-target 後，你會看到什麼

如果 target 真的收到 request，你去看：

- `GET /_mock/requests`

應該會看到類似：

```json
{
  "ok": true,
  "count": 1,
  "items": [
    {
      "requestId": "abc123",
      "method": "POST",
      "path": "/device/living-room-ac/set-temperature",
      "bodyJson": {
        "temperature": 25
      }
    }
  ]
}
```

這就是你未來在家裡真實 API 最重要的參考依據。

## 11. 第一輪建議測哪些 Telegram 指令

先從最簡單的開始：

### 電源

- `打開客廳冷氣`
- `關閉客廳冷氣`

### 溫度

- `把客廳冷氣調到 25 度`
- `把冷氣設定成 26 度`

測試時同步看三個地方：

1. Telegram 回覆
2. MyTeleBot `/admin/audit`
3. mock-target `/_mock/requests`

## 12. 如果要改成 bearer auth，怎麼升級

等你 `Auth type = none` 跑通後，再做第二輪：

### mock-target

部署時加環境變數：

```bash
MOCK_TARGET_AUTH_TYPE=bearer
MOCK_TARGET_AUTH_SECRET=replace-with-long-secret
```

### MyTeleBot target

把 target 改成：

- `Auth type`: `bearer`
- `Auth secret`: 同一把 secret

然後再按：

- `Test target connection`

## 13. 如果之後要對照家裡真實 API，怎麼看

mock-target 最有價值的地方是：

- 它會把 MyTeleBot 真正打過來的 request 完整記下來

所以你之後設計家庭 API 時，可以直接從 request log 反推：

- 路由命名要長什麼樣
- body 要接受哪些欄位
- auth 要選 `bearer` 還是 `hmac`

例如你發現 MyTeleBot 最後穩定打出的是：

```text
POST /device/living-room-ac/set-temperature
{"temperature":25}
```

那你家裡 gateway 就可以刻意照這個 contract 寫，不用再猜。

## 14. 第一輪不建議做的事

先不要一開始就：

- 建很多 device
- 建很多 command
- 啟用 `confirmationRequired`
- 設 cooldown
- 上 `hmac`

因為那會讓你在雲端 debug 時，同時面對太多變數。

最好的順序是：

1. `Target = none auth`
2. 一台 `Device`
3. 一個 `set_power`
4. 一個 `set_temperature`
5. dry run
6. 真實 Telegram 測
7. mock-target 看 request
8. 再慢慢加 auth / cooldown / confirmation

## 15. 建議的第一組完整設定摘要

### Target

```text
Target key: render-mock-target
Name: Render Mock Target
Base URL: https://mytelebot-mock-target.onrender.com
Auth type: none
Timeout (ms): 8000
Auth secret:
```

### Device

```text
Device key: living-room-ac
Name: 客廳冷氣
Type: air_conditioner
Description: Render mock target test device
Aliases JSON: ["冷氣","客廳冷氣","aircon","ac"]
```

### Command 1

```text
Command key: set_power
Label: 設定電源
Method: POST
Path: /device/living-room-ac/power
Aliases JSON: ["開機","關機","打開","關閉","power"]
Payload template JSON: {"state":"{{state}}"}
Args schema JSON: {"type":"object","properties":{"state":{"type":"string","enum":["ON","OFF"]}},"required":["state"]}
Confirmation required: false
Cooldown seconds: 0
```

### Command 2

```text
Command key: set_temperature
Label: 設定溫度
Method: POST
Path: /device/living-room-ac/set-temperature
Aliases JSON: ["調溫","設定溫度","溫度","temperature"]
Payload template JSON: {"temperature":"{{temperature}}"}
Args schema JSON: {"type":"object","properties":{"temperature":{"type":"number","minimum":18,"maximum":30}},"required":["temperature"]}
Confirmation required: false
Cooldown seconds: 0
```
