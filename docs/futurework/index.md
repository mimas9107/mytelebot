# Future Work

## ESP-MIAO Integration Plan

這組文件整理的是：

- `mytelebot` 如何與 `esp-miao` 串接
- 哪一邊應該負責什麼
- 為什麼不建議只同步一份簡化 `device table`
- 比較安全、可維護的落地順序

建議閱讀順序：

1. [`01-integration-overview.md`](/home/mimas/projects/mytelebot/docs/futurework/01-integration-overview.md)
2. [`02-sync-contract-draft.md`](/home/mimas/projects/mytelebot/docs/futurework/02-sync-contract-draft.md)
3. [`03-rollout-plan.md`](/home/mimas/projects/mytelebot/docs/futurework/03-rollout-plan.md)
4. [`04-myxiaomi-and-esp-miao-role-analysis.md`](/home/mimas/projects/mytelebot/docs/futurework/04-myxiaomi-and-esp-miao-role-analysis.md)

這份規劃文件的前提是：

- `esp-miao` 目前已具備 ESP32 語音入口、ASR、Ollama 意圖解析、MQTT discovery 與 MQTT dispatch
- `mytelebot` 目前已具備 Telegram 入口、Provider/Target/Device/Command registry、審計、安全驗證與 HTTP target dispatch
- 本規劃只分析串接方式，不修改 [`../esp-miao/`](/home/mimas/projects/esp-miao)
