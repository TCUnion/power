# TCU Power Analysis Web Frontend

這是 TCU 功率分析系統的 React 前端介面，提供 PMC 圖表、每日訓練紀錄與詳細的活動分析。

## 🛠️ 如何開始

### 1. 安裝相依套件
在 `web` 目錄下執行：
```bash
npm install
```

### 2. 環境變數設定
將 `.env.example` 複製為 `.env`：
```bash
cp .env.example .env
```
並填入你的 **Supabase URL** 與 **Anon Key**。

### 3. 啟動開發伺服器
```bash
npm run dev
```
啟動後可以在瀏覽器查看儀表板。

## 📸 功能預覽
- **PMC 圖表**: 追蹤 CTL/ATL/TSB 趨勢。
- **每日訓練圖表**: 視覺化每日 TSS 與心率。
- **活動同步**: 與 Strava 無縫同步詳細數據流。
- **AI 分析**: 整合 GPT-4 提供專業訓練建議。

---
*Created with ❤️ by TCUnion*
