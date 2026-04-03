# 02. Sync Contract Draft

## 1. 目標

如果 `esp-miao` 要把已 discovery 的家中設備主動送給 `mytelebot`，
建議送的是：

- gateway 描述
- device 描述
- command 描述

而不是只送一份目前內部使用的 device table。

## 2. 為什麼不只送 device table

因為 `mytelebot` 的 registry 需要：

- `Target`
- `Device`
- `DeviceCommand`

其中 `DeviceCommand` 又包含：

- `method`
- `path`
- `payloadTemplateJson`
- `argsSchemaJson`
- `aliases`

這些都不是目前 `esp-miao` 內部 device table 的完整責任。

## 3. 建議同步入口

建議未來由 `mytelebot` 提供一個整合 API，例如：

```text
POST /api/integrations/esp-miao/sync
```

用途：

- 接收 `esp-miao` 的 gateway snapshot
- 做匯入預覽
- 或建立待確認項目

不建議一開始就做成：

- 無條件直接覆蓋 registry

## 4. 建議 payload

```json
{
  "integration": {
    "source": "esp-miao",
    "version": "0.7.1",
    "gateway_id": "esp-miao-home"
  },
  "gateway": {
    "target_key": "esp-miao-home",
    "name": "ESP-MIAO Home Gateway",
    "base_url": "http://esp-miao.local:8000",
    "auth_type": "bearer"
  },
  "devices": [
    {
      "device_key": "living-room-light",
      "name": "客廳落地燈",
      "type": "light",
      "aliases": ["客廳燈", "落地燈"],
      "online": true,
      "commands": [
        {
          "command_key": "turn_on",
          "label": "開燈",
          "aliases": ["開燈", "打開"],
          "method": "POST",
          "path": "/api/actions",
          "payload_template_json": {
            "action": "relay_set",
            "target": "living-room-light",
            "value": "on"
          },
          "args_schema_json": null
        },
        {
          "command_key": "turn_off",
          "label": "關燈",
          "aliases": ["關燈", "關閉"],
          "method": "POST",
          "path": "/api/actions",
          "payload_template_json": {
            "action": "relay_set",
            "target": "living-room-light",
            "value": "off"
          },
          "args_schema_json": null
        }
      ]
    }
  ]
}
```

## 5. 欄位映射

### gateway -> `Target`

- `target_key` -> `Target.targetKey`
- `name` -> `Target.name`
- `base_url` -> `Target.baseUrl`
- `auth_type` -> `Target.authType`

### device -> `Device`

- `device_key` -> `Device.deviceKey`
- `name` -> `Device.name`
- `type` -> `Device.type`
- `aliases` -> `Device.aliasesJson`

### command -> `DeviceCommand`

- `command_key` -> `DeviceCommand.commandKey`
- `label` -> `DeviceCommand.label`
- `aliases` -> `DeviceCommand.aliasesJson`
- `method` -> `DeviceCommand.method`
- `path` -> `DeviceCommand.path`
- `payload_template_json` -> `DeviceCommand.payloadTemplateJson`
- `args_schema_json` -> `DeviceCommand.argsSchemaJson`

## 6. 安全建議

初期同步不要直接覆蓋正式 registry。

建議分兩步：

1. 匯入成候選項目
2. admin 在 `mytelebot` 後台確認啟用

這樣可避免：

- `esp-miao` discovery 突然冒出未預期設備
- alias 過寬
- command 模板錯誤
- gateway path 規格變動時直接污染正式控制面

## 7. 最小可行 HTTP action contract

如果先走 `mytelebot -> esp-miao`，則 `esp-miao` 還需要最小控制 API：

```text
POST /api/actions
```

request:

```json
{
  "action": "relay_set",
  "target": "living-room-light",
  "value": "on",
  "source": "mytelebot"
}
```

success:

```json
{
  "ok": true,
  "dispatched": true,
  "dispatchType": "mqtt",
  "target": "living-room-light",
  "value": "on"
}
```

business reject:

```json
{
  "ok": false,
  "error": "device_offline",
  "message": "device is offline"
}
```

這種回傳格式和 `mytelebot` 現在的 target contract 是相容的。
