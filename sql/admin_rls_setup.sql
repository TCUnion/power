-- 1. 啟用 Row Level Security (RLS)
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;

-- 2. 允許 Authenticated 用戶讀取 (AI Agent 查詢用)
CREATE POLICY "Allow authenticated read"
ON ad_placements
FOR SELECT
TO authenticated
USING (true);

-- 3. 允許 service@tsu.com.tw 進行所有操作 (增刪改查)
CREATE POLICY "Allow service admin full access"
ON ad_placements
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'service@tsu.com.tw')
WITH CHECK (auth.jwt() ->> 'email' = 'service@tsu.com.tw');

-- 4. 允許 service_role 無限制操作 (n8n 使用)
-- 預設 service_role 擁有繞過 RLS 的權限，通常不需要額外設定，但在某些極端情況下可明確宣告
-- 此處保持預設即可。

-- 驗證：請確保 service@tsu.com.tw 使用者已存在於 auth.users 表中。
