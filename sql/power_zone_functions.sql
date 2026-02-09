-- ============================================
-- 功率分析 PostgreSQL 函數
-- 用於計算功率區間、NP、TSS 等指標
-- ============================================

-- 1. 計算功率區間界限函數
CREATE OR REPLACE FUNCTION calculate_power_zones(ftp INTEGER)
RETURNS TABLE (
    zone INTEGER,
    zone_name TEXT,
    min_power INTEGER,
    max_power INTEGER,
    color TEXT
) AS $$
BEGIN
    -- 標準 Coggan 功率區間
    RETURN QUERY SELECT
        z.zone,
        z.zone_name,
        z.min_power,
        z.max_power,
        z.color
    FROM (VALUES
        (1, '主動恢復', 0, ROUND(ftp * 0.55)::INTEGER, '#9CA3AF'),
        (2, '耐力', ROUND(ftp * 0.56)::INTEGER, ROUND(ftp * 0.75)::INTEGER, '#60A5FA'),
        (3, '節奏', ROUND(ftp * 0.76)::INTEGER, ROUND(ftp * 0.90)::INTEGER, '#34D399'),
        (4, '乳酸閾值', ROUND(ftp * 0.91)::INTEGER, ROUND(ftp * 1.05)::INTEGER, '#FBBF24'),
        (5, 'VO2max', ROUND(ftp * 1.06)::INTEGER, ROUND(ftp * 1.20)::INTEGER, '#F97316'),
        (6, '無氧', ROUND(ftp * 1.21)::INTEGER, ROUND(ftp * 1.50)::INTEGER, '#EF4444'),
        (7, '神經肌肉', ROUND(ftp * 1.51)::INTEGER, 9999, '#A855F7')
    ) AS z(zone, zone_name, min_power, max_power, color);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. 計算 Normalized Power (NP) 函數
-- 使用 30 秒滑動平均 + 4 次方平均
CREATE OR REPLACE FUNCTION calculate_normalized_power(power_data JSONB)
RETURNS INTEGER AS $$
DECLARE
    powers INTEGER[];
    rolling_avg FLOAT[];
    sum_fourth_power FLOAT := 0;
    count_values INTEGER := 0;
    i INTEGER;
    window_sum FLOAT;
    np FLOAT;
BEGIN
    -- 將 JSONB 轉換為整數陣列
    SELECT ARRAY(SELECT (value::TEXT)::INTEGER FROM jsonb_array_elements(power_data))
    INTO powers;
    
    IF array_length(powers, 1) < 30 THEN
        -- 數據點不足，返回簡單平均
        RETURN (SELECT AVG(p) FROM unnest(powers) AS p);
    END IF;
    
    -- 計算 30 秒滑動平均
    FOR i IN 30..array_length(powers, 1) LOOP
        window_sum := 0;
        FOR j IN (i-29)..i LOOP
            window_sum := window_sum + powers[j];
        END LOOP;
        sum_fourth_power := sum_fourth_power + POWER(window_sum / 30, 4);
        count_values := count_values + 1;
    END LOOP;
    
    -- 計算 NP
    np := POWER(sum_fourth_power / count_values, 0.25);
    
    RETURN ROUND(np)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. 計算 Training Stress Score (TSS) 函數
CREATE OR REPLACE FUNCTION calculate_tss(
    np INTEGER,
    ftp INTEGER,
    duration_seconds INTEGER
)
RETURNS FLOAT AS $$
DECLARE
    intensity_factor FLOAT;
    tss FLOAT;
BEGIN
    IF ftp <= 0 OR np <= 0 THEN
        RETURN 0;
    END IF;
    
    intensity_factor := np::FLOAT / ftp::FLOAT;
    tss := (duration_seconds * np * intensity_factor) / (ftp * 3600) * 100;
    
    RETURN ROUND(tss::NUMERIC, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. 分析活動功率分佈函數
CREATE OR REPLACE FUNCTION analyze_activity_power_distribution(
    p_activity_id BIGINT,
    p_ftp INTEGER
)
RETURNS TABLE (
    zone INTEGER,
    zone_name TEXT,
    time_in_zone INTEGER,
    percentage FLOAT,
    avg_power INTEGER,
    color TEXT
) AS $$
DECLARE
    power_data JSONB;
    zones RECORD;
BEGIN
    -- 獲取活動的功率數據
    SELECT 
        (SELECT s->>'data' FROM jsonb_array_elements(streams) s WHERE s->>'type' = 'watts')::JSONB
    INTO power_data
    FROM strava_streams
    WHERE activity_id = p_activity_id;
    
    IF power_data IS NULL THEN
        RETURN;
    END IF;
    
    -- 為每個功率區間計算統計
    FOR zones IN SELECT * FROM calculate_power_zones(p_ftp) LOOP
        RETURN QUERY
        SELECT
            zones.zone,
            zones.zone_name,
            (SELECT COUNT(*)::INTEGER 
             FROM jsonb_array_elements_text(power_data) p 
             WHERE p::INTEGER >= zones.min_power AND p::INTEGER <= zones.max_power),
            0.0::FLOAT, -- 稍後計算百分比
            (SELECT COALESCE(AVG(p::INTEGER), 0)::INTEGER 
             FROM jsonb_array_elements_text(power_data) p 
             WHERE p::INTEGER >= zones.min_power AND p::INTEGER <= zones.max_power),
            zones.color;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. 計算心率區間函數
CREATE OR REPLACE FUNCTION calculate_hr_zones(max_hr INTEGER)
RETURNS TABLE (
    zone INTEGER,
    zone_name TEXT,
    min_hr INTEGER,
    max_hr_val INTEGER,
    color TEXT
) AS $$
BEGIN
    RETURN QUERY SELECT
        z.zone,
        z.zone_name,
        z.min_hr,
        z.max_hr_val,
        z.color
    FROM (VALUES
        (1, '恢復區', ROUND(max_hr * 0.50)::INTEGER, ROUND(max_hr * 0.60)::INTEGER, '#9CA3AF'),
        (2, '有氧區', ROUND(max_hr * 0.60)::INTEGER, ROUND(max_hr * 0.70)::INTEGER, '#60A5FA'),
        (3, '節奏區', ROUND(max_hr * 0.70)::INTEGER, ROUND(max_hr * 0.80)::INTEGER, '#34D399'),
        (4, '閾值區', ROUND(max_hr * 0.80)::INTEGER, ROUND(max_hr * 0.90)::INTEGER, '#FBBF24'),
        (5, '無氧區', ROUND(max_hr * 0.90)::INTEGER, max_hr, '#EF4444')
    ) AS z(zone, zone_name, min_hr, max_hr_val, color);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 註解
COMMENT ON FUNCTION calculate_power_zones IS '根據 FTP 計算 Coggan 功率區間';
COMMENT ON FUNCTION calculate_normalized_power IS '計算 Normalized Power (30秒滑動平均 + 4次方平均)';
COMMENT ON FUNCTION calculate_tss IS '計算 Training Stress Score';
COMMENT ON FUNCTION analyze_activity_power_distribution IS '分析活動的功率區間分佈';
COMMENT ON FUNCTION calculate_hr_zones IS '根據最大心率計算心率區間';
