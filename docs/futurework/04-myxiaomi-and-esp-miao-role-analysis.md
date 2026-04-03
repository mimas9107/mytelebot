# 04. MyXiaomi and ESP-MIAO Role Analysis

## 1. 為什麼要把 `myxiaomi` 一起納入分析

如果只看 `mytelebot` 與 `esp-miao`，很容易把整體問題想成：

- 語音控制系統要不要和 Telegram 控制系統整合

但加入 `myxiaomi` 後，架構其實更清楚：

- `esp-miao` 不只是語音入口
- `myxiaomi` 也不是單純一台設備
- 它們分別代表不同層級的責任

## 2. `myxiaomi` 的角色

從 [`../myxiaomi/README.md`](/home/mimas/projects/myxiaomi/README.md) 與
[`../myxiaomi/vacuumd/mqtt_bridge.py`](/home/mimas/projects/myxiaomi/vacuumd/mqtt_bridge.py)
可看出：

- `myxiaomi` 是掃地機專屬 domain service
- 它封裝了 LAN-first 控制、retry、cache、scheduler、watchdog、安全規則
- 它同時提供：
  - REST API
  - MQTT bridge
  - CLI

因此它的定位不是「控制中心」，而是：

- **設備專屬控制服務**
- **設備 adapter / service layer**

## 3. `esp-miao` 的角色

`esp-miao` 的強項是：

- ESP32 語音入口
- ASR / 本地語音交互
- discovery hub
- MQTT 指令發送

對掃地機而言，它目前已經透過 MQTT 控制 `myxiaomi`：

```text
esp-miao
-> home/vacuum_01/cmd
-> myxiaomi mqtt bridge
-> vacuum controller
```

所以：

- `esp-miao` 比較像家中語音主控入口
- 它不是所有設備的最底層 adapter

## 4. `mytelebot` 的角色

`mytelebot` 的強項是：

- Telegram 入口
- LLM provider 管理
- 白名單 registry
- args schema / confirmation / cooldown
- audit / admin UI / secret 管理

因此它更像：

- **外部遠端控制平面**
- **管理平面**
- **策略與審計層**

## 5. 三者一起看的合理分層

最自然的角色關係應該是：

```text
人在家:
人
-> esp-miao
-> MQTT / 本地設備服務
-> myxiaomi / 其他 adapter
-> 家電

人在外:
人
-> Telegram
-> mytelebot
-> 家中 gateway / 內網 adapter service
-> myxiaomi / 其他 adapter
-> 家電
```

## 6. 為什麼 `mytelebot` 不應直接取代 `myxiaomi`

因為 `myxiaomi` 已經處理了很多掃地機特有問題：

- LAN-first 通訊穩定性
- 狀態快取
- watchdog
- scheduler conflict guard
- battery guard
- fake cloud / DNS 攔截策略

如果 `mytelebot` 直接重做這些：

- 會重複造輪子
- 也會把設備專屬風險帶進控制平面

更合理的做法是：

- `myxiaomi` 仍負責掃地機專屬控制
- `mytelebot` 只把它視為一個可呼叫的 target / service

## 7. 對 `esp-miao -> mytelebot` 裝置同步的影響

加入 `myxiaomi` 後，未來同步裝置資訊時要注意：

- discovery 上來的不只是 device name
- 還應該知道該裝置背後是否由某個專屬 service 管理

例如：

- `vacuum_01`
  - 不是裸設備
  - 而是由 `myxiaomi` domain service 管理

這個差異在後續規劃中很重要，因為它會影響：

- target mapping
- audit 呈現
- error message
- command 模板來源

## 8. 目前最合理的工程結論

短期：

- 不急著讓三者深度整合
- 因為在家時直接用 `esp-miao` 語音控制更自然
- 而且目前外網條件仍不穩定

中期：

- 可讓 `mytelebot` 把 `esp-miao` 或家中 gateway 當成 target
- 再由 gateway / service 轉到 `myxiaomi`

長期：

- 才考慮統一 registry、同步 contract、跨入口審計與策略整合

## 9. 一句話總結

三者的合理定位應該是：

- `myxiaomi`: 掃地機專屬控制服務
- `esp-miao`: 家中語音主控入口
- `mytelebot`: 外部遠端控制與管理平面

未來若整合，`mytelebot` 應站在它們上層做 orchestration，
而不是取代 `esp-miao` 或 `myxiaomi` 的既有專長。
