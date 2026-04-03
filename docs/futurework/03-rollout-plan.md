# 03. Rollout Plan

## 1. 短期階段

目標：

- 先讓 `mytelebot` 能控制 `esp-miao`
- 不先重構 `esp-miao` 既有 ASR / intent / MQTT 主流程

步驟：

1. `esp-miao` 提供受保護的 HTTP action API
2. `mytelebot` 建立一個 `Target`
3. 手動建立第一批 `Device` / `Command`
4. 用 mock target 驗證過的同樣方式測通
5. 再把真實家中裝置鍵值對齊

## 2. 中期階段

目標：

- 減少 `mytelebot` 與 `esp-miao` 兩邊重複維護裝置資料

步驟：

1. `esp-miao` 提供穩定的裝置 inventory 輸出
2. `mytelebot` 實作 import preview
3. admin 確認後匯入 registry
4. 保持人工審核，不直接自動覆蓋正式資料

## 3. 長期階段

目標：

- 統一 Telegram 與語音的控制規則

可選做法：

- `esp-miao` 保留 ASR
- 文字辨識後，把控制決策交給 `mytelebot`

這樣可讓：

- Telegram 指令
- 語音指令

共用同一套：

- target / device / command registry
- args schema
- confirmation
- cooldown
- audit

## 4. 推薦里程碑

### Milestone 1

- `esp-miao` 新增 `POST /api/actions`
- `mytelebot` 手動建立 gateway target
- 驗證基本 on/off 控制

### Milestone 2

- `esp-miao` 提供 `GET /devices`
- `mytelebot` 支援匯入預覽

### Milestone 3

- `esp-miao` 主動 push sync
- `mytelebot` 後台做人工確認後寫入 registry

### Milestone 4

- 重新評估是否要把語音控制決策中心逐步集中到 `mytelebot`

## 5. 風險清單

### 命名不一致

如果兩邊 key 命名不一致，例如：

- `living-room-light`
- `light_01`
- `客廳燈`

那同步與 audit 會很難追。

建議：

- 先制定 key naming convention
- alias 再另外補

### 自動覆蓋 registry

如果 discovery 直接覆蓋正式 registry，會讓安全模型被削弱。

建議：

- 初期只做 import preview

### command 模板不足

目前 `esp-miao` 比較偏簡單 `target + value`
模型，若要控制冷氣溫度或複合命令，需要額外擴充 command schema。

## 6. 最後建議

如果只求最快落地：

- 先不要碰深度雙向同步
- 先做 `mytelebot -> esp-miao` 的 HTTP gateway 串接

如果要求長期維護性：

- 再逐步往同步 contract 與 import preview 演進
