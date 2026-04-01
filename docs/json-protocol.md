# JSON 溝通協定草案

## 1. 設計原則
- 所有外部設定都資料化，不把 provider 或 device 邏輯硬寫在 prompt 中
- LLM 只負責意圖理解與結構化輸出，不直接決定最終 URL 與任意 payload
- 所有 JSON 都需經 `zod` 或等價 schema 驗證

## 2. LLM Provider 設定 JSON

```json
{
  "provider_id": "openrouter-main",
  "name": "OpenRouter Main",
  "base_url": "https://openrouter.ai/api/v1",
  "model": "openai/gpt-4.1-mini",
  "api_key_secret_id": "sec_provider_openrouter_main",
  "extra_headers": {
    "HTTP-Referer": "https://mytelebot.example.com",
    "X-Title": "MyTeleBot"
  },
  "capabilities": {
    "capability_profile": "openai_compatible",
    "json_output_mode": "json_object",
    "json_strict": true,
    "tool_calling": false,
    "vision": false
  },
  "status": "active"
}
```

欄位說明：
- `provider_id`: 系統內唯一 ID
- `base_url`: OpenAI-compatible API base URL
- `model`: 實際呼叫模型名稱
- `api_key_secret_id`: 對應 secrets table，不直接存明文 key
- `extra_headers`: 某些供應商需要額外標頭
- `capability_profile`: 供應商類型提示，目前可用於 UI 與 parse policy
- `json_output_mode`: `prompt_only` 或 `json_object`
- `json_strict`: 是否要求模型只輸出 JSON
- `status`: `active` 或 `inactive`

Rotation policy:
- Provider API key rotation should create a new secret row instead of mutating the old encrypted value in-place.
- The previous secret should be marked with `rotated_at`.
- The provider record should point to the newest secret only.

## 3. Telegram 使用者 allowlist JSON

```json
{
  "telegram_user_id": "123456789",
  "user_id": "usr_admin_main",
  "username": "$ADMIN_USER",
  "display_name": "Mimas",
  "role": "admin",
  "status": "active"
}
```

## 4. Target Server 定義 JSON

```json
{
  "target_id": "home-gateway-taipei",
  "name": "Taipei Home Gateway",
  "base_url": "https://home-gateway.example.com/api",
  "auth": {
    "type": "bearer",
    "secret_id": "sec_target_taipei_gateway"
  },
  "timeout_ms": 8000,
  "status": "active"
}
```

可支援的 `auth.type`：
- `none`
- `bearer`
- `header`
- `query`
- `hmac`

## 5. Device 與 Command Registry JSON

```json
{
  "device_id": "living-room-ac",
  "target_id": "home-gateway-taipei",
  "name": "客廳冷氣",
  "aliases": ["冷氣", "客廳冷氣"],
  "type": "air_conditioner",
  "description": "客廳吊隱式冷氣",
  "commands": [
    {
      "command_id": "turn_on",
      "label": "開機",
      "aliases": ["打開", "開燈", "turn_on"],
      "method": "POST",
      "path": "/ac/living-room/power",
      "payload_template": {
        "power": "on"
      },
      "args_schema": {},
      "confirmation_required": false
    },
    {
      "command_id": "set_temperature",
      "label": "設定溫度",
      "aliases": ["調溫", "設溫度"],
      "method": "POST",
      "path": "/ac/living-room/temperature",
      "payload_template": {
        "temperature": "{{temperature}}"
      },
      "args_schema": {
        "type": "object",
        "properties": {
          "temperature": {
            "type": "number",
            "minimum": 18,
            "maximum": 30
          }
        },
        "required": ["temperature"]
      },
      "confirmation_required": false
    }
  ],
  "status": "active"
}
```

重點：
- `path` 僅能是相對路徑，避免任意外連
- `payload_template` 使用可控模板替換，不接受 LLM 自由定義完整 payload
- `args_schema` 定義 LLM 可填入的參數範圍
- `aliases` 必須由管理者顯式維護，不做自由推測
- `command aliases` 只用於命中既有 command，不放寬裝置白名單

## 6. 給 LLM 的控制上下文 JSON

這份資料不一定原封不動存 DB，但應該能由 DB 組合出來：

```json
{
  "available_targets": [
    {
      "target_id": "home-gateway-taipei",
      "devices": [
        {
          "device_id": "living-room-ac",
          "name": "客廳冷氣",
          "type": "air_conditioner",
          "commands": [
            {
              "command_id": "turn_on",
              "label": "開機",
              "aliases": ["打開", "開燈"],
              "args": {}
            },
            {
              "command_id": "set_temperature",
              "label": "設定溫度",
              "aliases": ["調溫"],
              "args": {
                "temperature": "number 18-30"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## 7. LLM 結構化輸出 JSON

```json
{
  "intent": "device_control",
  "response_text": "我會把客廳冷氣調整到 25 度。",
  "requires_confirmation": false,
  "actions": [
    {
      "target_id": "home-gateway-taipei",
      "device_id": "living-room-ac",
      "command_id": "set_temperature",
      "args": {
        "temperature": 25
      }
    }
  ]
}
```

支援的 `intent`：
- `device_control`
- `device_query`
- `chat`
- `reject`

若無法安全判斷，LLM 應回：

```json
{
  "intent": "reject",
  "response_text": "我無法確定你要控制哪一台設備，請重新描述。",
  "requires_confirmation": false,
  "actions": []
}
```

注意：
- 即使 LLM 輸出合法 `device_id`，後端仍會檢查原始文字是否明確提到該裝置或 alias。
- webhook JSON 與 Telegram reply 應共用相同 `reason_code`，並盡量提供 operator hint。

## 10. Operational metrics JSON

```json
{
  "ok": true,
  "component": "metrics",
  "generatedAt": "2026-04-01T06:00:00.000Z",
  "metrics": {
    "activeProviders": 1,
    "activeTargets": 2,
    "dispatchSuccess24h": 12,
    "dispatchFailures24h": 3,
    "pendingConfirmations": 1,
    "telegramReceived24h": 25,
    "providerErrors24h": 0
  },
  "events": [
    {
      "id": "audit_123",
      "createdAt": "2026-04-01T05:55:00.000Z",
      "actorType": "admin",
      "actorId": "usr_admin_main",
      "executionStatus": "provider_api_key_rotated",
      "errorMessage": null,
      "rawInput": "rotate provider api key integration-mock-provider"
    }
  ]
}
```

## 8. 後端執行請求 JSON

後端在驗證通過後，會轉為 dispatcher 專用格式：

```json
{
  "execution_id": "exec_20260331_001",
  "actor": {
    "source": "telegram",
    "telegram_user_id": "123456789"
  },
  "target": {
    "target_id": "home-gateway-taipei",
    "base_url": "https://home-gateway.example.com/api"
  },
  "request": {
    "method": "POST",
    "url": "/ac/living-room/temperature",
    "headers": {
      "Authorization": "Bearer ***"
    },
    "payload": {
      "temperature": 25
    }
  },
  "audit": {
    "raw_command": "把客廳冷氣調到 25 度",
    "llm_intent": "device_control"
  }
}
```

## 9. 目標設備回應 JSON

建議家庭 gateway 或目標 API 盡量統一回傳：

```json
{
  "ok": true,
  "device_id": "living-room-ac",
  "command_id": "set_temperature",
  "message": "temperature set",
  "state": {
    "power": "on",
    "temperature": 25
  }
}
```

失敗格式：

```json
{
  "ok": false,
  "error_code": "DEVICE_OFFLINE",
  "message": "living-room-ac is unreachable"
}
```

## 10. Webhook API 回應 JSON

目前 `POST /api/telegram/webhook` 會固定回傳下列基礎欄位：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success"
}
```

欄位說明：
- `stage`: `received | authorization | provider | parse | validation | dispatch`
- `intent`: 目前主要為 `device_control` 或 `null`
- `parsed`: LLM 是否成功產出可用解析結果
- `validated`: 是否通過 target/device/command 與參數驗證
- `dispatched`: 是否真的送出並成功完成 target 呼叫
- `status`: 目前流程狀態碼
- `reasonCode`: webhook JSON 與 Telegram reply 共用的原因碼

成功範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success",
  "reasonCode": "dispatch_success",
  "message": "Command dispatched successfully.",
  "targetKey": "espmiao",
  "deviceKey": "light_01",
  "commandKey": "lightcommands",
  "args": {
    "state": "ON"
  },
  "dispatch": {
    "ok": true,
    "status": 200,
    "errorType": null,
    "errorMessage": null
  }
}
```

驗證失敗範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "validation",
  "intent": "device_control",
  "parsed": true,
  "validated": false,
  "dispatched": false,
  "status": "validation_failed",
  "reasonCode": "device_not_found",
  "message": "找不到指定的裝置。",
  "validationReason": "device_not_found"
}
```

重複 `update_id` 範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "authorization",
  "intent": null,
  "parsed": false,
  "validated": false,
  "dispatched": false,
  "status": "duplicate_update_ignored",
  "reasonCode": "duplicate_update_ignored",
  "message": "Duplicate Telegram update ignored.",
  "deduplicated": true
}
```

## 10. Webhook API 回應 JSON

目前 `POST /api/telegram/webhook` 會固定回傳下列基礎欄位：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success"
}
```

欄位說明：
- `stage`: `received | authorization | provider | parse | validation | dispatch`
- `intent`: 目前主要為 `device_control` 或 `null`
- `parsed`: LLM 是否成功產出可用解析結果
- `validated`: 是否通過 target/device/command 與參數驗證
- `dispatched`: 是否真的送出並成功完成 target 呼叫
- `status`: 目前流程狀態碼

成功範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success",
  "targetKey": "espmiao",
  "deviceKey": "light_01",
  "commandKey": "lightcommands",
  "args": {
    "state": "ON"
  },
  "dispatch": {
    "ok": true,
    "status": 200,
    "errorType": null,
    "errorMessage": null
  }
}
```

驗證失敗範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "validation",
  "intent": "device_control",
  "parsed": true,
  "validated": false,
  "dispatched": false,
  "status": "validation_failed",
  "validationReason": "device_not_found"
}
```

重複 `update_id` 範例：

```json
{
  "ok": true,
  "authorized": true,
  "stage": "authorization",
  "intent": null,
  "parsed": false,
  "validated": false,
  "dispatched": false,
  "status": "duplicate_update_ignored",
  "deduplicated": true
}
```

## 10. 稽核紀錄 JSON

```json
{
  "audit_id": "aud_20260331_001",
  "actor_type": "telegram",
  "actor_id": "123456789",
  "provider_id": "openrouter-main",
  "model": "openai/gpt-4.1-mini",
  "raw_input": "把客廳冷氣調到 25 度",
  "parsed_result": {
    "intent": "device_control",
    "actions": [
      {
        "target_id": "home-gateway-taipei",
        "device_id": "living-room-ac",
        "command_id": "set_temperature",
        "args": {
          "temperature": 25
        }
      }
    ]
  },
  "execution_status": "success",
  "error_message": null,
  "created_at": "2026-03-31T02:30:00.000Z"
}
```

## 11. Webhook 測試回應 JSON

```json
{
  "ok": true,
  "authorized": true,
  "stage": "dispatch",
  "intent": "device_control",
  "parsed": true,
  "validated": true,
  "dispatched": true,
  "status": "dispatch_success",
  "targetKey": "home-gateway-taipei",
  "deviceKey": "living-room-ac",
  "commandKey": "turn_on",
  "args": {
    "power": "on"
  },
  "dispatch": {
    "ok": true,
    "status": 200,
    "errorType": null,
    "errorMessage": null
  }
}
```

重送保護：
- 相同 `update_id` 的 Telegram webhook 只會處理一次
- 重複呼叫會回 `status = "duplicate_update_ignored"`

## 11. Prompt 邊界規則
系統 prompt 應明確要求模型：
- 只能從提供的 `target_id`, `device_id`, `command_id` 中選擇
- 不能虛構不存在的設備或命令
- 若資訊不足，必須輸出 `reject`
- 輸出必須是單一 JSON object
- 不輸出 markdown，不輸出解釋文字
