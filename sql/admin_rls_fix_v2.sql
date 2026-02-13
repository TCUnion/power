-- 強制修復 RLS 權限 (v2 增強版)

-- 1. 為了確保乾淨，先停用 RLS 再啟用 (這會清除所有綁定的 Policy 嗎？不會，只是關閉檢查)
ALTER TABLE ad_placements DISABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;

-- 2. 刪除所有現存 Policy (確保沒有殘留的阻擋規則)
DROP POLICY IF EXISTS "Allow authenticated read" ON ad_placements;
DROP POLICY IF EXISTS "Allow service admin full access" ON ad_placements;
DROP POLICY IF EXISTS "Allow service admin write access" ON ad_placements;
DROP POLICY IF EXISTS "Enable read access for all users" ON ad_placements;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON ad_placements;
DROP POLICY IF EXISTS "Enable update for users based on email" ON ad_placements;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON ad_placements;

-- 3. 建立新 Policy (使用 lower() 忽略大小寫與 trim() 去除空白)
-- Policy A: 允許所有已登入用戶「讀取」
CREATE POLICY "RLS_Read_All_Auth"
ON ad_placements
FOR SELECT
TO authenticated
USING (true);

-- Policy B: 允許 service@tsu.com.tw 「寫入/修改/刪除」
-- 條件：當前用戶 Email (忽略大小寫) 必須是 service@tsu.com.tw
CREATE POLICY "RLS_Write_Admin_Only"
ON ad_placements
FOR ALL
TO authenticated
USING (
  lower(trim((auth.jwt() ->> 'email')::text)) = 'service@tsu.com.tw'
)
WITH CHECK (
  lower(trim((auth.jwt() ->> 'email')::text)) = 'service@tsu.com.tw'
);

-- 4. 再次確保 Table 權限
GRANT ALL ON ad_placements TO authenticated;
GRANT ALL ON ad_placements TO service_role;
