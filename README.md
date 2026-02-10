# TCU Power Analysis (TCUnion/power)

此專案用於 TCU (Taiwan Cyclist Union) 的功率數據分析，整合 Strava 資料、Morton's 3-Parameter Critical Power 模型與 AI 分析，提供選手個人化的訓練建議。

## 📂 專案結構

- **workflows/**: n8n 工作流 JSON 檔案
  - `TCU-功率分析-42天AI報告.json`: 主工作流，執行 ETL、計算指標並發送通知。
- **src/**: 核心演算法邏輯 (JavaScript)
  - `critical-power-model.js`: 包含 CP 模型、MMP 曲線計算、TSS/CTL/ATL 計算邏輯。
- **sql/**: 資料庫遷移與函式定義
  - `power_zone_functions.sql`: PostgreSQL 功率區間計算函式。

## 🚀 功能特色

1. **自動化數據同步**: 透過 n8n 定期從 Strava 同步活動數據。
2. **進階功率模型**:
   - **Morton's 3-Parameter CP**: 計算 Critical Power (CP) 與 W' (Anaerobic Work Capacity)。
   - **MMP 曲線**: 分析 1秒至 2小時的最大平均功率。
   - **訓練負荷追蹤**: 計算 CTL (長期負荷)、ATL (短期負荷) 與 TSB (訓練壓力平衡)。
3. **AI 智能分析**:
   - 整合 OpenAI GPT-4，根據數據提供個人化訓練建議。
   - 自動判斷 FTP 變化趨勢與疲勞狀態。
4. **多管道通知**: 支援 Line Notify 與 Email 報告推送。

## 🛠️ 安裝與部署

1. **n8n 工作流匯入**:
   - 將 `workflows/TCU-功率分析-42天AI報告.json` 匯入至 n8n。
   - 設定對應的 Supabase PostgreSQL、OpenAI API 與 Line Notify 憑證。

2. **資料庫設定**:
   - 確保 PostgreSQL 資料庫已建立 `strava_activities`, `strava_streams`, `athletes` 等資料表。
   - 執行 `sql/power_zone_functions.sql` 建立必要的資料庫函式。

## 📊 核心演算法參考

- **Critical Power**: 基於 Morton's 3-parameter model (`P(t) = CP + W' / (t - τ)`)
- **Normalized Power**:  Coggan's algorithm (30s moving average -> 4th power mean)
- **TSS/CTL/ATL**: Training Stress Score 體系

## 🔗 相關資源


- [Velozs Cycling Analytics](https://github.com/velozs/cycling-analytics)
- [GoldenCheetah](https://github.com/GoldenCheetah/GoldenCheetah)

## ⚖️ 致敬與版權聲明 (Acknowledgements)

本專案部分核心演算法與 UI 設計致敬以下開源專案：

- **GoldenCheetah** (GPL v2):
  - Dashboard UI 設計靈感 (Power & W' Balance Chart)
  - Critical Power 模型演算法概念 (Morton 3P, GoldenCheetah 2P)
  - W' Balance 計算邏輯 (Skiba 2012 / Integral Method)

- **Cycling Analytics**:
  - CP 模型演算法概念 (Monod & Scherrer 2P)

我們感謝開源社群對運動科學軟體的貢獻。本專案旨在網頁端提供類似的分析體驗，協助台灣自行車騎士科學化訓練。
