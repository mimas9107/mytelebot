# Mock Target TODO

## 目標

把這個 mock-target 維持成一個可獨立拆出的最小 Python 專案，用來：

- 驗證 MyTeleBot 的 target dispatch 契約
- 觀察 method / path / headers / body
- 協助未來家中真實 API 的設計

## 目前已完成

- FastAPI catch-all target endpoint
- `/health`
- request recorder
- `success` / `business_error` / `http_error` / `timeout`
- `none` / `bearer` / `header` / `query` / `hmac`
- `/_mock/*` 類管理接口
- `README.md`

## 待辦

- 為 `/_mock/*` 補更細的 admin auth 文件範例
- 加上 request log 匯出功能，例如 JSON download
- 加上 response profile presets，例如 `401`、`403`、`404`、`500`
- 加上更接近真實家庭 gateway 的 sample routes 文件
- 補自動化測試
- 補 Render 部署截圖或逐步教學
- 補 Dockerfile，方便未來非 Render 部署
- 考慮加入簡單 persistent storage，避免 free plan 重啟後 request log 全失
