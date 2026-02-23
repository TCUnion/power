-- ============================================================
-- LINE 會員綁定功能 - 資料表建立
-- 建立日期：2026-02-20
-- 說明：用於 LINE 聊天室內的 TCU 會員綁定流程
-- ============================================================

-- 1. line_member_bindings - 儲存 LINE 與 TCU 會員的綁定關係
CREATE TABLE IF NOT EXISTS line_member_bindings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id TEXT NOT NULL UNIQUE,           -- LINE userId（唯一識別使用者）
    line_display_name TEXT,                       -- LINE 顯示名稱
    tcu_account TEXT NOT NULL,                    -- TCU 帳號（身份證字號）
    tcu_member_email TEXT,                        -- TCU 會員 Email
    member_name TEXT,                             -- 會員真實姓名
    strava_id TEXT,                               -- 若有同時綁定 Strava
    bound_at TIMESTAMPTZ DEFAULT NOW(),           -- 綁定時間
    updated_at TIMESTAMPTZ DEFAULT NOW(),         -- 更新時間
    status TEXT DEFAULT 'active'                  -- 狀態：active / unbound
);

-- NOTE: 啟用 RLS 確保資料安全
ALTER TABLE line_member_bindings ENABLE ROW LEVEL SECURITY;

-- 允許 service_role 完整存取（n8n 使用 service_role key）
CREATE POLICY "service_role_full_access_line_bindings"
    ON line_member_bindings
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_line_member_bindings_line_user_id
    ON line_member_bindings(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_member_bindings_tcu_account
    ON line_member_bindings(tcu_account);

-- ============================================================
-- 2. line_binding_sessions - 追蹤多輪對話的綁定會話狀態
-- NOTE: 此表用於追蹤使用者在 LINE 中的綁定多輪對話步驟
-- ============================================================
CREATE TABLE IF NOT EXISTS line_binding_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id TEXT NOT NULL,
    step TEXT NOT NULL DEFAULT 'awaiting_tcu_id',   -- awaiting_tcu_id / awaiting_otp / completed
    tcu_id_input TEXT,                               -- 使用者輸入的 TCU-ID
    tcu_member_email TEXT,                            -- 對應的會員 Email
    member_name TEXT,                                 -- 會員姓名
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
    UNIQUE(line_user_id)                              -- 每個使用者一次只能有一個進行中的 session
);

ALTER TABLE line_binding_sessions ENABLE ROW LEVEL SECURITY;

-- 允許 service_role 完整存取
CREATE POLICY "service_role_full_access_line_sessions"
    ON line_binding_sessions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_line_binding_sessions_line_user_id
    ON line_binding_sessions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_binding_sessions_expires_at
    ON line_binding_sessions(expires_at);

-- ============================================================
-- 3. 自動清理過期 session 的函式（可選）
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_binding_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM line_binding_sessions
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
