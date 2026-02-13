-- 修正 Sequence 權限問題
-- 當此表有 auto-increment ID 時，必須授予 sequence 權限才能進行 INSERT

GRANT USAGE, SELECT ON SEQUENCE ad_placements_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE ad_placements_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ad_placements_id_seq TO anon; -- 雖然目前不允許 anon 寫入，但預防性授權

-- 確保主 table 權限
GRANT ALL ON ad_placements TO authenticated;
GRANT ALL ON ad_placements TO service_role;
