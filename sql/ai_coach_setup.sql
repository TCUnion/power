-- ============================================
-- AI 教練資料庫設定
-- 包含：對話紀錄 + 廣告業配
-- 請在 Supabase SQL Editor 中執行
-- ============================================

-- ==========================================
-- 1. AI 教練對話紀錄表
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_coach_logs (
  id BIGSERIAL PRIMARY KEY,
  athlete_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL,          -- 'summary' 或 'chat'
  user_message TEXT,                   -- 使用者提問（chat 用，summary 時為 NULL）
  ai_response TEXT NOT NULL,           -- AI 回覆內容
  context_data JSONB,                  -- 當次查詢的數據摘要
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_logs_athlete ON ai_coach_logs(athlete_id);
CREATE INDEX IF NOT EXISTS idx_ai_coach_logs_type ON ai_coach_logs(athlete_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_coach_logs_created ON ai_coach_logs(athlete_id, created_at DESC);

-- 權限設定
GRANT ALL ON ai_coach_logs TO service_role;
GRANT SELECT, INSERT ON ai_coach_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ai_coach_logs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ai_coach_logs_id_seq TO authenticated;

-- ==========================================
-- 2. 廣告商品庫
-- ==========================================
CREATE TABLE IF NOT EXISTS ad_placements (
  id BIGSERIAL PRIMARY KEY,
  brand_name VARCHAR(100) NOT NULL,           -- 品牌名稱
  product_name VARCHAR(200) NOT NULL,         -- 商品名稱
  product_url TEXT,                            -- 商品連結
  description TEXT NOT NULL,                   -- 商品描述（供 AI 使用）
  trigger_keywords TEXT[],                     -- 觸發關鍵字
  trigger_conditions JSONB,                    -- 進階觸發條件
  placement_text TEXT NOT NULL,                -- AI 置入時的參考文案
  priority INT DEFAULT 5,                      -- 優先順序（1=最高）
  is_active BOOLEAN DEFAULT true,              -- 是否啟用
  start_date DATE,                             -- 上架日期
  end_date DATE,                               -- 下架日期
  max_impressions INT,                         -- 最大曝光次數（NULL=無限）
  current_impressions INT DEFAULT 0,           -- 目前曝光次數
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON ad_placements TO service_role;
GRANT SELECT ON ad_placements TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ad_placements_id_seq TO service_role;

-- ==========================================
-- 3. 廣告曝光追蹤表
-- ==========================================
CREATE TABLE IF NOT EXISTS ad_impressions (
  id BIGSERIAL PRIMARY KEY,
  ad_id BIGINT REFERENCES ad_placements(id),
  athlete_id BIGINT NOT NULL,
  context VARCHAR(20) NOT NULL,        -- 'summary' 或 'chat'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_athlete ON ad_impressions(athlete_id);

GRANT ALL ON ad_impressions TO service_role;
GRANT SELECT, INSERT ON ad_impressions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ad_impressions_id_seq TO service_role;

-- ==========================================
-- 4. 測試廣告資料
-- ==========================================
INSERT INTO ad_placements (brand_name, product_name, product_url, description, trigger_keywords, placement_text, priority)
VALUES
(
  'SIS 英國運動科學',
  'Beta Fuel 80 能量膠',
  'https://www.scienceinsport.com/beta-fuel',
  '專為耐力運動設計的能量膠，每包提供 80g 碳水化合物，適合長距離騎乘補給。',
  ARRAY['耐力', '補給', '長距離', '能量', '騎乘時間長'],
  '長距離騎乘的能量補給首選！SIS Beta Fuel 80 能量膠，每包 80g 碳水，讓你在漫長的爬坡中持續輸出。',
  3
),
(
  'Garmin',
  'Edge 1050 自行車碼表',
  'https://www.garmin.com/edge-1050',
  '頂級自行車碼表，支援功率分析、訓練負荷追蹤、即時天氣、觸控螢幕。適合注重訓練數據的車友。',
  ARRAY['功率', '數據', '訓練', 'FTP', 'TSS', '分析'],
  '想要更精準掌握你的功率數據？Garmin Edge 1050 自行車碼表，即時功率分析 + 訓練負荷追蹤，讓每一次訓練都有數據支撐。',
  5
),
(
  'MAAP',
  'Training Bib 3.0 車褲',
  'https://maap.cc/training-bib',
  '專業訓練車褲，義大利 ELASTIC INTERFACE 坐墊，適合長時間騎乘。透氣排汗布料，減少摩擦。',
  ARRAY['舒適', '裝備', '長時間', '車褲', '騎乘'],
  '訓練量持續增加，裝備也要跟上！MAAP Training Bib 3.0 車褲，義大利頂級坐墊 + 透氣面料，讓你長距離騎乘更舒適。',
  7
);

-- 確認結果
SELECT '✅ 建表完成！' AS status;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columns
FROM information_schema.tables t 
WHERE t.table_schema = 'public' 
  AND t.table_name IN ('ai_coach_logs', 'ad_placements', 'ad_impressions')
ORDER BY t.table_name;
