# 01. Integration Overview

## 1. 問題定義

目前兩個專案各自擅長不同工作：

- `esp-miao`
  - ESP32 語音入口
  - WebSocket 音訊串流
  - ASR
  - 關鍵字 + Ollama 意圖解析
  - MQTT device discovery
  - MQTT 指令派發

- `mytelebot`
  - Telegram 入口
  - LLM provider 管理
  - Target / Device / Command 白名單
  - confirmation / cooldown / args schema 驗證
  - audit / admin UI / secret 管理
  - HTTP target dispatch

因此兩者不是互相取代，而是可以形成：

```text
語音控制能力 (esp-miao)
+ 控制平面 / 管理平面 (mytelebot)
= 可統一治理的家庭控制系統
```

## 2. 現況限制

`esp-miao` 目前真正對設備下指令的地方在：

- [`dispatch.py`](/home/mimas/projects/esp-miao/src/esp_miao/dispatch.py)

它的做法是：

- 先從 discovery registry 找 device
- 再直接用 MQTT publish

這代表：

- `mytelebot` 目前不能直接零修改把 `esp-miao` 當 target 控制
- 因為 `esp-miao` 現在缺少一個給外部控制用的 HTTP action API

## 3. 三種串接方向

### 方案 A: `mytelebot -> esp-miao`

做法：

- `esp-miao` 提供一個受保護的 HTTP action API
- `mytelebot` 把 `esp-miao` 視為 target gateway

流程：

```text
Telegram
-> mytelebot
-> esp-miao HTTP API
-> esp-miao MQTT dispatch
-> 家中設備
```

優點：

- 最短可落地
- 幾乎不用重構 `mytelebot`
- 保留 `esp-miao` 既有 discovery / MQTT 控制鏈

缺點：

- `esp-miao` 需要補 HTTP action API
- richer args 模型要逐步擴充

### 方案 B: `esp-miao -> mytelebot`

做法：

- `esp-miao` 保留 ESP32 + ASR
- 文字辨識後，把控制決策交給 `mytelebot`

流程：

```text
ESP32
-> esp-miao (ASR)
-> mytelebot (LLM + registry + dispatch)
-> target gateway
-> 家中設備
```

優點：

- Telegram 與語音共用同一套安全規則
- 所有 audit / whitelist / confirmation 集中

缺點：

- `mytelebot` 需要新增一個「非 Telegram 文字入口」API
- `esp-miao` 現有 intent / dispatch 責任需要重切

### 方案 C: Hybrid

做法：

- `esp-miao` 保留低延遲本地簡單控制
- 複雜跨設備或高風險控制交給 `mytelebot`

這個方向長期最靈活，但短期不是最簡單。

## 4. 建議方向

短期建議採：

- **先做方案 A**
- 再逐步補方案 C 能力

原因：

- 對現有兩邊程式碼侵入最小
- `mytelebot` 已有 target dispatch 與 registry
- `esp-miao` 只要增加一層 HTTP gateway API 即可

## 5. 另一個重要問題：可不可以把 `esp-miao` 的 device table 主動傳給 `mytelebot`

可以，但不建議只傳現在的簡化 `device table`。

理由是：

- `mytelebot` 不只需要知道有哪些裝置
- 還需要知道：
  - target 是誰
  - command 是誰
  - path / method / payload 怎麼組
  - args schema 是什麼
  - 哪些 alias 要納入白名單

因此比較正確的說法是：

- `esp-miao` 應該同步的是 **可匯入的 gateway/device/command 描述**
- 而不是只同步它自己內部的 runtime device table

## 6. 推薦責任邊界

### `esp-miao` 負責

- ESP32 連線
- 語音音訊上傳
- ASR
- MQTT discovery
- MQTT online/offline status
- 實際 dispatch 到家中設備

### `mytelebot` 負責

- 遠端控制入口
- 白名單與命令模型
- 審計
- 風險控制
- target/device/command 管理
- provider 管理

## 7. 結論

最務實的做法是：

1. `esp-miao` 提供可控的 HTTP gateway API
2. `mytelebot` 先把 `esp-miao` 當 target
3. 再設計裝置同步 contract
4. 最後才考慮更深度的雙向整合
