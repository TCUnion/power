-- 修復 RLS 權限問題
-- 先刪除舊的 Policy 以免衝突
DROP POLICY IF EXISTS "Allow authenticated read" ON ad_placements;
DROP POLICY IF EXISTS "Allow service admin full access" ON ad_placements;

-- 確保啟用 RLS
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;

-- 1. 允許所有已登入用戶讀取 (AI Agent & Admin 都需要)
CREATE POLICY "Allow authenticated read"
ON ad_placements
FOR SELECT
TO authenticated
USING (true);

-- 2. 允許 service@tsu.com.tw 進行寫入 (INSERT/UPDATE/DELETE)
-- 使用 auth.jwt() ->> 'email' 檢查目前登入者的 Email
CREATE POLICY "Allow service admin write access"
ON ad_placements
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'service@tsu.com.tw')
WITH CHECK (auth.jwt() ->> 'email' = 'service@tsu.com.tw');

-- 3. 確保 service_role (Server端) 擁有完整權限
-- 雖然 service_role 預設繞過 RLS，但明確 grant 也無妨
GRANT ALL ON ad_placements TO service_role;
