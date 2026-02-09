# TCU Power Analysis Context

## 1. 專案背景
本專案是從 `STRAVATCU` 遷移出來的獨立模組，專注於自行車功率數據分析。

## 2. 核心功能
### A. 進階功率模型 (Morton's 3-Parameter Critical Power)
- 檔案: `src/critical-power-model.js`
- 演算法: 使用 Levenberg-Marquardt 非線性擬合計算 CP, W', Tau
- 特色:
  - 自動計算 MMP 曲線 (1s - 2h)
  - 指數衰減 CTL/ATL 計算 (取代簡單平均)
  - AI FTP 預測 (基於 20min/60min/CP 模型)

### B. 自動化報告 (n8n Workflow)
- 檔案: `workflows/TCU-功率分析-42天AI報告.json`
- 流程:
  1. 定期從 Strava 同步數據 (Webhook/Schedule)
  2. 查詢 PostgreSQL `strava_streams` (過去 42 天)
  3. 執行 JS 演算法計算 CP 模型與訓練指標
  4. 呼叫 OpenAI 進行教練分析
  5. 透過 Line/Email 發送報告

### C. 資料庫擴充
- 檔案: `sql/power_zone_functions.sql`
- 功能: 提供 PostgreSQL 函式計算功率區間、NP、TSS

## 3. 遷移狀態
- ✅ 檔案已遷移至 `TCUnion/power`
- ✅ 舊專案 (`STRAVATCU`) 相關檔案已清理
- ⚠️ 待驗證事項:
  - n8n 工作流匯入後需重新設定 Credential
  - SQL 函式需部署至 Supabase
  - AI Prompt 效果需測試

## 4. 下一步行動
1. 在 Supabase 執行 `sql/power_zone_functions.sql`
2. 將 `workflows/TCU-功率分析-42天AI報告.json` 匯入 n8n
3. 設定 Line Notify 與 OpenAI API Key
4. 發動測試並觀察 AI 分析結果
