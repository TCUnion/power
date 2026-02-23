-- ============================================
-- 修正 FTP 歷史紀錄 PostgreSQL 函數
-- 用於整批更新特定選手在特定日期之後的所有活動的 FTP，以自動重新計算 PMC
-- ============================================

CREATE OR REPLACE FUNCTION update_athlete_ftp_history(
    p_athlete_id BIGINT,
    p_new_ftp INTEGER,
    p_effective_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    IF p_new_ftp <= 0 THEN
        RAISE EXCEPTION 'FTP must be greater than 0';
    END IF;

    -- 更新 strava_streams 中的 ftp，透過 activity_id 關聯到 strava_activities 來過濾選手與日期
    WITH updated AS (
        UPDATE strava_streams ss
        SET 
            ftp = p_new_ftp,
            updated_at = NOW()
        FROM strava_activities sa
        WHERE ss.activity_id = sa.id
          AND sa.athlete_id = p_athlete_id
          AND sa.start_date >= p_effective_date
        RETURNING ss.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'FTP history updated successfully',
        'updated_count', v_updated_count,
        'athlete_id', p_athlete_id,
        'new_ftp', p_new_ftp,
        'effective_date', p_effective_date
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 權限設定
GRANT EXECUTE ON FUNCTION update_athlete_ftp_history(BIGINT, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION update_athlete_ftp_history(BIGINT, INTEGER, TIMESTAMP WITH TIME ZONE) TO service_role;
