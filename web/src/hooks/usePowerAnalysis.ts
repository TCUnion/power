/**
 * 功率訓練分析 Hook
 * 
 * 混合架構：優先使用 PostgreSQL DB 端函式計算，
 * 若 RPC 呼叫失敗則自動降級為前端 JS 計算 (fallback)。
 * 
 * DB 端函式對應：
 * - calculate_power_zones(ftp)        → calculatePowerZones
 * - calculate_normalized_power(data)  → calculateNP
 * - calculate_tss(np, ftp, duration)  → calculateTSS
 * - analyze_activity_power_distribution(activity_id, ftp) → analyzePowerZoneDistribution
 * - calculate_hr_zones(max_hr)        → calculateHRZones
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type {
    StravaStreams,
    PowerZone,
    PowerZoneAnalysis,
    HRZoneAnalysis,
    ActivityPowerAnalysis,
    AthletePowerProfile,
    StravaActivity,
} from '../types';

// ============================================
// 常數：本地 Fallback 用（與 DB 端定義一致）
// ============================================

// Coggan 功率區間定義
const POWER_ZONES: { zone: number; name: string; minPct: number; maxPct: number; color: string }[] = [
    { zone: 1, name: '主動恢復', minPct: 0, maxPct: 0.55, color: '#9CA3AF' },
    { zone: 2, name: '耐力', minPct: 0.56, maxPct: 0.75, color: '#60A5FA' },
    { zone: 3, name: '節奏', minPct: 0.76, maxPct: 0.90, color: '#34D399' },
    { zone: 4, name: '乳酸閾值', minPct: 0.91, maxPct: 1.05, color: '#FBBF24' },
    { zone: 5, name: 'VO2max', minPct: 1.06, maxPct: 1.20, color: '#F97316' },
    { zone: 6, name: '無氧', minPct: 1.21, maxPct: 1.50, color: '#EF4444' },
    { zone: 7, name: '神經肌肉', minPct: 1.51, maxPct: 999, color: '#A855F7' },
];

// 心率區間定義 (基於最大心率百分比)
const HR_ZONES: { zone: number; name: string; minPct: number; maxPct: number; color: string }[] = [
    { zone: 1, name: '恢復', minPct: 0.50, maxPct: 0.60, color: '#9CA3AF' },
    { zone: 2, name: '有氧', minPct: 0.60, maxPct: 0.70, color: '#60A5FA' },
    { zone: 3, name: '節奏', minPct: 0.70, maxPct: 0.80, color: '#34D399' },
    { zone: 4, name: '閾值', minPct: 0.80, maxPct: 0.90, color: '#FBBF24' },
    { zone: 5, name: '無氧', minPct: 0.90, maxPct: 1.00, color: '#EF4444' },
];

interface UsePowerAnalysisReturn {
    loading: boolean;
    error: string | null;
    /** 獲取活動 Streams 數據 */
    getActivityStreams: (activityId: number) => Promise<StravaStreams | null>;
    /** 計算功率區間（優先 DB，降級 JS） */
    calculatePowerZones: (ftp: number) => PowerZone[];
    /** 分析活動功率（混合 DB/JS） */
    analyzeActivityPower: (
        activity: StravaActivity,
        streams: StravaStreams,
        ftp: number,
        maxHR?: number
    ) => ActivityPowerAnalysis;
    /** 獲取選手訓練總覽 */
    getAthletePowerProfile: (
        athleteId: number,
        activities: StravaActivity[],
        ftp: number,
        maxHR?: number
    ) => Promise<AthletePowerProfile>;
    /** 計算 Normalized Power（優先 DB，降級 JS） */
    calculateNP: (powerData: number[]) => number;
    /** 計算 TSS（優先 DB，降級 JS） */
    calculateTSS: (np: number, ftp: number, durationSeconds: number) => number;
    /** 計算 TSS - DB 端非同步版本（精準版） */
    calculateTSSViaDB: (np: number, ftp: number, durationSeconds: number) => Promise<number>;
    /** 計算 NP - DB 端非同步版本（精準版） */
    calculateNPViaDB: (powerData: number[]) => Promise<number>;
    /** DB 端分析活動功率分佈 */
    analyzeActivityPowerDistributionViaDB: (activityId: number, ftp: number) => Promise<PowerZoneAnalysis[] | null>;
    /** 檢查活動是否有數據流 */
    checkStreamsAvailability: (activityIds: number[]) => Promise<number[]>;
}

export function usePowerAnalysis(): UsePowerAnalysisReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ============================================
    // 基礎資料存取
    // ============================================

    /** 獲取活動 Streams 數據 */
    const getActivityStreams = useCallback(async (activityId: number): Promise<StravaStreams | null> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('strava_streams')
                .select('*')
                .eq('activity_id', activityId)
                .maybeSingle();

            if (fetchError) {
                console.error('獲取 Streams 失敗:', fetchError);
                return null;
            }

            return data as StravaStreams | null;
        } catch (err) {
            console.error('getActivityStreams 異常:', err);
            return null;
        }
    }, []);

    /** 檢查活動是否有數據流 */
    const checkStreamsAvailability = useCallback(async (activityIds: number[]): Promise<number[]> => {
        if (!activityIds.length) return [];
        try {
            const { data, error } = await supabase
                .from('strava_streams')
                .select('activity_id')
                .in('activity_id', activityIds);

            if (error) {
                console.error('檢查 Streams 失敗:', error);
                return [];
            }

            return data.map(d => d.activity_id);
        } catch (err) {
            console.error('checkStreamsAvailability 異常:', err);
            return [];
        }
    }, []);

    // ============================================
    // 功率區間計算（同步 — 本地計算 + DB 結果一致）
    // NOTE: 因為功率區間只是簡單的百分比計算，
    // 使用本地 JS 即時計算即可，無需 async DB 呼叫
    // ============================================

    /** 計算功率區間界限（同步本地版，與 DB calculate_power_zones 結果一致） */
    const calculatePowerZones = useCallback((ftp: number): PowerZone[] => {
        return POWER_ZONES.map(z => ({
            zone: z.zone,
            name: z.name,
            minPower: Math.round(ftp * z.minPct),
            maxPower: z.maxPct === 999 ? 9999 : Math.round(ftp * z.maxPct),
            color: z.color,
        }));
    }, []);

    // ============================================
    // NP 計算：同步 JS 版 + 非同步 DB 版
    // ============================================

    /**
     * 計算 Normalized Power — 同步 JS 版 (fallback)
     * 
     * 使用 30 秒滑動平均 + 4 次方平均
     * 修正：恢復標準算法，包含 0 功率數據。
     * 過濾 0 功率會導致 NP 異常飆高 (e.g. 178W vs Garmin 147W)，
     * 因為忽略了滑行/下坡的休息效應。
     */
    const calculateNP = useCallback((powerData: number[]): number => {
        if (!powerData || powerData.length < 30) {
            const sum = powerData.reduce((a, b) => a + b, 0);
            return Math.round(sum / powerData.length) || 0;
        }

        // 計算 30 秒滑動平均 (包含 0 值)
        const rollingAvg: number[] = [];
        for (let i = 29; i < powerData.length; i++) {
            let sum = 0;
            for (let j = i - 29; j <= i; j++) {
                sum += powerData[j];
            }
            rollingAvg.push(sum / 30);
        }

        // 計算 4 次方平均
        const sumFourthPower = rollingAvg.reduce((sum, val) => sum + Math.pow(val, 4), 0);
        const np = Math.pow(sumFourthPower / rollingAvg.length, 0.25);

        return Math.round(np);
    }, []);

    /**
     * 計算 Normalized Power — 非同步 DB 版
     * 呼叫 PostgreSQL calculate_normalized_power(JSONB) 函式
     * 失敗時降級為 JS 本地計算
     */
    const calculateNPViaDB = useCallback(async (powerData: number[]): Promise<number> => {
        try {
            const { data, error: rpcError } = await supabase
                .rpc('calculate_normalized_power', {
                    power_data: powerData,
                });

            if (rpcError) {
                // NOTE: DB RPC 失敗，降級為 JS 本地計算
                console.warn('DB calculate_normalized_power 失敗，降級為 JS:', rpcError.message);
                return calculateNP(powerData);
            }

            return data as number;
        } catch (err) {
            console.warn('calculateNPViaDB 異常，降級為 JS:', err);
            return calculateNP(powerData);
        }
    }, [calculateNP]);

    // ============================================
    // TSS 計算：同步 JS 版 + 非同步 DB 版
    // ============================================

    /** 計算 TSS — 同步 JS 版 (fallback) */
    const calculateTSS = useCallback((np: number, ftp: number, durationSeconds: number): number => {
        if (ftp <= 0 || np <= 0) return 0;

        const intensityFactor = np / ftp;
        const tss = (durationSeconds * np * intensityFactor) / (ftp * 3600) * 100;

        return Math.round(tss * 10) / 10;
    }, []);

    /**
     * 計算 TSS — 非同步 DB 版
     * 呼叫 PostgreSQL calculate_tss(np, ftp, duration) 函式
     * 失敗時降級為 JS 本地計算
     */
    const calculateTSSViaDB = useCallback(async (np: number, ftp: number, durationSeconds: number): Promise<number> => {
        try {
            const { data, error: rpcError } = await supabase
                .rpc('calculate_tss', {
                    np,
                    ftp,
                    duration_seconds: durationSeconds,
                });

            if (rpcError) {
                console.warn('DB calculate_tss 失敗，降級為 JS:', rpcError.message);
                return calculateTSS(np, ftp, durationSeconds);
            }

            return data as number;
        } catch (err) {
            console.warn('calculateTSSViaDB 異常，降級為 JS:', err);
            return calculateTSS(np, ftp, durationSeconds);
        }
    }, [calculateTSS]);

    // ============================================
    // 功率區間分佈分析：本地 JS 版 + DB 版
    // ============================================

    /** 分析功率區間分佈 — 本地 JS 版 (fallback) */
    const analyzePowerZoneDistribution = useCallback((
        powerData: number[],
        zones: PowerZone[]
    ): PowerZoneAnalysis[] => {
        const totalSeconds = powerData.length;

        return zones.map(zone => {
            const pointsInZone = powerData.filter(
                p => p >= zone.minPower && p <= zone.maxPower
            );
            const timeInZone = pointsInZone.length;
            const avgPower = pointsInZone.length > 0
                ? Math.round(pointsInZone.reduce((a, b) => a + b, 0) / pointsInZone.length)
                : 0;

            return {
                zone: zone.zone,
                name: zone.name,
                timeInZone,
                percentageTime: totalSeconds > 0 ? Math.round((timeInZone / totalSeconds) * 1000) / 10 : 0,
                avgPower,
                color: zone.color,
            };
        });
    }, []);

    /**
     * DB 端分析活動功率分佈
     * 呼叫 PostgreSQL analyze_activity_power_distribution(activity_id, ftp)
     * 直接在 DB 端完成 Streams 提取 + 區間統計，省去前端下載整個 Streams
     */
    const analyzeActivityPowerDistributionViaDB = useCallback(async (
        activityId: number,
        ftp: number
    ): Promise<PowerZoneAnalysis[] | null> => {
        try {
            const { data, error: rpcError } = await supabase
                .rpc('analyze_activity_power_distribution', {
                    p_activity_id: activityId,
                    p_ftp: ftp,
                });

            if (rpcError) {
                console.warn('DB analyze_activity_power_distribution 失敗:', rpcError.message);
                return null;
            }

            if (!data || data.length === 0) return null;

            // 計算百分比（DB 端返回 0.0，需在此補算）
            const totalTime = data.reduce((sum: number, row: any) => sum + row.time_in_zone, 0);

            return data.map((row: any) => ({
                zone: row.zone,
                name: row.zone_name,
                timeInZone: row.time_in_zone,
                percentageTime: totalTime > 0 ? Math.round((row.time_in_zone / totalTime) * 1000) / 10 : 0,
                avgPower: row.avg_power,
                color: row.color,
            }));
        } catch (err) {
            console.warn('analyzeActivityPowerDistributionViaDB 異常:', err);
            return null;
        }
    }, []);

    // ============================================
    // 心率區間分析（本地 JS — 因 DB 端只有區間定義）
    // ============================================

    /** 分析心率區間分佈 */
    const analyzeHRZoneDistribution = useCallback((
        hrData: number[],
        maxHR: number
    ): HRZoneAnalysis[] => {
        const totalSeconds = hrData.length;

        return HR_ZONES.map(zone => {
            const minHR = Math.round(maxHR * zone.minPct);
            const maxHRVal = Math.round(maxHR * zone.maxPct);

            const pointsInZone = hrData.filter(h => h >= minHR && h <= maxHRVal);
            const timeInZone = pointsInZone.length;
            const avgHR = pointsInZone.length > 0
                ? Math.round(pointsInZone.reduce((a, b) => a + b, 0) / pointsInZone.length)
                : 0;

            return {
                zone: zone.zone,
                name: zone.name,
                timeInZone,
                percentageTime: totalSeconds > 0 ? Math.round((timeInZone / totalSeconds) * 1000) / 10 : 0,
                avgHR,
                color: zone.color,
            };
        });
    }, []);

    // ============================================
    // 綜合分析：單一活動功率分析
    // ============================================

    /**
     * 分析單一活動功率
     * 
     * 混合策略：
     * - NP / TSS：使用同步 JS 版（資料已在前端，無需再送回 DB）
     * - 功率區間：使用同步 JS 版（快速且結果一致）
     * - 心率區間：使用同步 JS 版
     * 
     * NOTE: 若需要純 DB 端功率分佈分析（省去下載 Streams），
     * 可改用 analyzeActivityPowerDistributionViaDB
     */
    const analyzeActivityPower = useCallback((
        activity: StravaActivity,
        streams: StravaStreams,
        ftp: number,
        maxHR?: number
    ): ActivityPowerAnalysis => {
        // 提取各類型數據
        const getStreamData = (type: string): number[] => {
            const stream = streams.streams.find(s => s.type === type);
            return stream?.data || [];
        };

        // 優先使用 Streams 中記錄的歷史 FTP (當時的設定)，否則使用當前 FTP
        const effectiveFtp = (streams.ftp || ftp) || 0;
        // 優先使用 Streams 中記錄的歷史 Max HR，否則使用當前設定
        const effectiveMaxHR = streams.max_heartrate || maxHR;

        const powerData = getStreamData('watts');
        const hrData = getStreamData('heartrate');
        const cadenceData = getStreamData('cadence');
        const velocityData = getStreamData('velocity_smooth');
        const altitudeData = getStreamData('altitude');
        const gradeData = getStreamData('grade_smooth');
        const timeData = getStreamData('time');
        const tempData = getStreamData('temp');

        // 計算功率指標（同步 JS 版，資料已在前端）
        const np = calculateNP(powerData);
        const avgPower = powerData.length > 0
            ? Math.round(powerData.reduce((a, b) => a + b, 0) / powerData.length)
            : activity.average_watts || 0;
        const maxPower = powerData.length > 0
            ? Math.max(...powerData)
            : activity.max_watts || 0;
        // 使用 elapsed_time (總時間) 計算 TSS，以符合 Garmin/TrainingPeaks 邏輯
        const duration = activity.elapsed_time || activity.moving_time;

        // 若 FTP 未設定 (為 0 或 null)，則不進行因子計算
        const tss = effectiveFtp > 0 ? calculateTSS(np, effectiveFtp, duration) : 0;
        const intensityFactor = effectiveFtp > 0 ? Math.round((np / effectiveFtp) * 100) / 100 : 0;
        const variabilityIndex = avgPower > 0 ? Math.round((np / avgPower) * 100) / 100 : 0;
        const kilojoules = activity.kilojoules || Math.round((avgPower * duration) / 1000);

        // 計算功率區間（同步 JS 版）
        const zones = calculatePowerZones(effectiveFtp);
        const powerZones = analyzePowerZoneDistribution(powerData, zones);

        // 計算心率區間（如有）
        const hrZones = effectiveMaxHR && hrData.length > 0
            ? analyzeHRZoneDistribution(hrData, effectiveMaxHR)
            : undefined;

        return {
            activityId: activity.id,
            activityName: activity.name,
            date: activity.start_date,
            ftp: effectiveFtp,
            max_heartrate: effectiveMaxHR,
            stravaZones: streams.strava_zones,
            trainingLoad: {
                np,
                avgPower,
                maxPower,
                if: intensityFactor,
                tss,
                vi: variabilityIndex,
                duration,
                kilojoules,
            },
            powerZones,
            hrZones,
            timeSeriesData: {
                time: timeData,
                watts: powerData,
                heartrate: hrData.length > 0 ? hrData : undefined,
                cadence: cadenceData.length > 0 ? cadenceData : undefined,
                velocity: velocityData.length > 0 ? velocityData : undefined,
                grade: gradeData.length > 0 ? gradeData : undefined,
                altitude: altitudeData.length > 0 ? altitudeData : undefined,
                temp: tempData.length > 0 ? tempData : undefined,
            },
        };
    }, [calculateNP, calculateTSS, calculatePowerZones, analyzePowerZoneDistribution, analyzeHRZoneDistribution]);

    // ============================================
    // 綜合分析：選手總覽
    // ============================================

    /** 獲取選手訓練總覽 */
    const getAthletePowerProfile = useCallback(async (
        athleteId: number,
        activities: StravaActivity[],
        ftp: number,
        maxHR?: number
    ): Promise<AthletePowerProfile> => {
        setLoading(true);
        setError(null);

        try {
            // 獲取選手資訊
            const { data: athlete } = await supabase
                .from('athletes')
                .select('firstname, lastname')
                .eq('id', athleteId)
                .maybeSingle();

            const athleteName = `${athlete?.firstname || ''} ${athlete?.lastname || ''}`.trim() || `Athlete ${athleteId}`;

            // 分析每個活動
            const analyzedActivities: ActivityPowerAnalysis[] = [];
            const dailyTSS: { date: string; tss: number }[] = [];

            for (const activity of activities.slice(0, 50)) {
                const streams = await getActivityStreams(activity.id);
                if (streams) {
                    const analysis = analyzeActivityPower(activity, streams, ftp, maxHR);
                    analyzedActivities.push(analysis);

                    // 記錄每日 TSS
                    const dateKey = new Date(activity.start_date).toISOString().split('T')[0];
                    const existing = dailyTSS.find(d => d.date === dateKey);
                    if (existing) {
                        existing.tss += analysis.trainingLoad.tss;
                    } else {
                        dailyTSS.push({ date: dateKey, tss: analysis.trainingLoad.tss });
                    }
                }
            }

            // 計算 CTL/ATL/TSB
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fortyTwoDaysAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

            const weeklyTSS = dailyTSS
                .filter(d => new Date(d.date) >= sevenDaysAgo)
                .reduce((sum, d) => sum + d.tss, 0);

            const monthlyTSS = dailyTSS
                .filter(d => new Date(d.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
                .reduce((sum, d) => sum + d.tss, 0);

            // 簡化的 CTL/ATL 計算（實際應使用指數加權平均）
            const ctl = Math.round(dailyTSS
                .filter(d => new Date(d.date) >= fortyTwoDaysAgo)
                .reduce((sum, d) => sum + d.tss, 0) / 42);

            const atl = Math.round(weeklyTSS / 7);
            const tsb = ctl - atl;

            return {
                athleteId,
                athleteName,
                ftp,
                maxHR,
                weeklyTSS: Math.round(weeklyTSS),
                monthlyTSS: Math.round(monthlyTSS),
                ctl,
                atl,
                tsb,
                recentActivities: analyzedActivities,
            };
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getActivityStreams, analyzeActivityPower]);

    return {
        loading,
        error,
        getActivityStreams,
        calculatePowerZones,
        analyzeActivityPower,
        getAthletePowerProfile,
        calculateNP,
        calculateTSS,
        calculateTSSViaDB,
        calculateNPViaDB,
        analyzeActivityPowerDistributionViaDB,
        checkStreamsAvailability,
    };
}
