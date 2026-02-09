# TCU Power Analysis Tasks

## 🚀 部署與設定
- [ ] **資料庫函式部署**
  - [ ] 在 Supabase SQL Editor 執行 `sql/power_zone_functions.sql`
  - [ ] 確認 `calculate_power_zones` 等函式建立成功

- [ ] **n8n 工作流設定**
  - [ ] 匯入 `workflows/TCU-功率分析-42天AI報告.json`
  - [ ] 設定 `Supabase PostgreSQL` Credential
  - [ ] 設定 `OpenAI API` Credential
  - [ ] 設定 `Line Notify` Credential

## 🧪 測試與驗證
- [ ] **功能測試**
  - [ ] 手動觸發工作流 (Test Workflow)
  - [ ] 檢查 SQL 查詢是否正確取得 42 天數據
  - [ ] 驗證 CP 模型計算結果 (CP, W', R²) 是否合理

- [ ] **AI 分析優化**
  - [ ] 觀察 OpenAI 回覆內容準確度
  - [ ] 調整 Prompt (如需要) 提升教練建議品質

- [ ] **通知測試**
  - [ ] 確認 Line 通知格式正確
  - [ ] 確認 Email 報告發送成功

## 🔄 持續迭代
- [ ] 收集測試反饋
- [ ] 優化 MMP 曲線視覺化 (前端整合)
