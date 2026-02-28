-- ============================================
-- LINE 聊天紀錄資料表
-- 用於記錄 TCU-LINE 工作流的所有對話歷史
-- ============================================

CREATE TABLE IF NOT EXISTS line_chat_history (
  id BIGSERIAL PRIMARY KEY,
  
  -- 使用者資訊
  line_user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  
  -- 訊息內容
  message_text TEXT,
  message_type TEXT DEFAULT 'text',
  message_id TEXT,
  
  -- AI 回覆
  ai_response TEXT,
  
  -- 來源資訊
  reply_token TEXT,
  source TEXT DEFAULT 'LINE',
  group_id TEXT,
  
  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 啟用 RLS
ALTER TABLE line_chat_history ENABLE ROW LEVEL SECURITY;

-- 建立索引：加速依使用者查詢
CREATE INDEX IF NOT EXISTS idx_line_chat_history_user_id ON line_chat_history(line_user_id);

-- 建立索引：加速依時間排序
CREATE INDEX IF NOT EXISTS idx_line_chat_history_created_at ON line_chat_history(created_at DESC);

-- RLS 政策：允許 service_role 完整存取（n8n 透過 service_role 寫入）
CREATE POLICY "service_role_full_access" ON line_chat_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE line_chat_history IS 'LINE 聊天紀錄，由 n8n TCU-LINE 工作流寫入';

-- 授予權限
GRANT ALL ON line_chat_history TO service_role;
GRANT SELECT ON line_chat_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE line_chat_history_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE line_chat_history_id_seq TO authenticated;
