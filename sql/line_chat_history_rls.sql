-- LINE 聊天紀錄 RLS 政策
-- 允許 admin（service@tsu.com.tw）讀取所有聊天紀錄

-- 啟用 RLS（若尚未啟用）
ALTER TABLE line_chat_history ENABLE ROW LEVEL SECURITY;

-- 允許 admin 讀取所有紀錄
CREATE POLICY "admin_read_chat_history" ON line_chat_history
  FOR SELECT
  USING (auth.jwt() ->> 'email' = 'service@tsu.com.tw');

-- LINE 會員綁定表 RLS 政策
-- 允許 admin 讀取所有綁定紀錄
CREATE POLICY "admin_read_member_bindings" ON line_member_bindings
  FOR SELECT
  USING (auth.jwt() ->> 'email' = 'service@tsu.com.tw');
