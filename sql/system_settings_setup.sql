-- ============================================
-- 系統設定表 (System Settings)
-- 
-- 用途：儲存全域設定，如 AI 教練每日限制
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- 權限設定 (與 ai_coach_logs 類似)
-- service_role: 全部權限
GRANT ALL ON system_settings TO service_role;

-- authenticated:
-- 讀取 (SELECT): 允許所有登入用戶讀取設定 (例如前端需要知道限制)
-- 修改 (UPDATE/INSERT): 僅限 Admin (透過 RLS 或後端檢查)
GRANT SELECT ON system_settings TO authenticated;

-- 啟用 RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS: 允許所有 Authenticated 用戶讀取
CREATE POLICY "Allow authenticated read system_settings"
ON system_settings
FOR SELECT
TO authenticated
USING (true);

-- RLS: 允許 service@tsu.com.tw 修改 (或由後端 service_role 處理)
-- 若後端使用 service_role key，則會繞過 RLS，這裡僅作備用
CREATE POLICY "Allow admin full access system_settings"
ON system_settings
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'service@tsu.com.tw')
WITH CHECK (auth.jwt() ->> 'email' = 'service@tsu.com.tw');

-- 插入預設值
INSERT INTO system_settings (key, value, description)
VALUES 
('ai_limit_guest', '5', '訪客/未付費會員每日 AI 對話限制'),
('ai_limit_basic', '10', '一般會員每日 AI 對話限制'),
('ai_limit_premium', '50', '付費會員每日 AI 對話限制')
ON CONFLICT (key) DO NOTHING;
