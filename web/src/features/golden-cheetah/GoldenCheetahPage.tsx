/**
 * GoldenCheetah Dashboard Clone
 * 
 * This page mimics the layout and functionality of the GoldenCheetah application dashboard.
 * It provides a detailed analysis of a single activity, including:
 * - Summary Metrics (TSS, IF, Work, Duration)
 * - Power & W' Balance Chart (Dual Axis)
 * - Power Zone Distribution
 * 
 * Copyright Notice:
 * The UI design and W' Balance algorithm are inspired by the GoldenCheetah project (https://github.com/GoldenCheetah/GoldenCheetah).
 * GoldenCheetah is licensed under GPL v2.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import type { StravaActivity, StravaStreams, StreamData, StravaZoneBucket } from '../../types';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    LabelList
} from 'recharts';
import { Activity, Info, Loader2, ArrowLeft, Thermometer, RotateCw, Heart, Clock, Gauge, FileText, RefreshCw, TrendingUp, Lock } from 'lucide-react';
import { fitMorton3P, calculateMMP, calculateNP } from '../../utils/power-models';
import { GaugeChart } from './GaugeChart';
import ActivitySelector from './components/ActivitySelector';
import PerformanceSummary from './components/PerformanceSummary';
import MainAnalysisChart from './components/MainAnalysisChart';
import ZoneDistribution from './components/ZoneDistribution';

// ============================================
// W' Balance Algorithm (Skiba 2012 / GoldenCheetah Style)
// ============================================
const calculateWPrimeBalance = (powerStream: number[], cp: number, wPrime: number) => {
    // Default tau for recovery (Skiba 2012 suggests ~570s, but dynamic is better)
    const TAU = 570;

    let wPrimeExp = 0; // Expended W' (Starts at 0)
    const balanceStream: number[] = [];

    for (let i = 0; i < powerStream.length; i++) {
        const p = powerStream[i];
        const dt = 1; // 1 second interval

        if (p > cp) {
            // Expenditure: Linear depletion
            wPrimeExp += (p - cp) * dt;
        } else {
            // Recovery: Exponential decay of expenditure
            // W'_exp(t) = W'_exp(t-1) * e^(-dt / tau)
            wPrimeExp *= Math.exp(-dt / TAU);
        }

        // Clip W' Expended to not exceed W' (Total Capacity)
        let balance = wPrime - wPrimeExp;
        if (balance > wPrime) balance = wPrime;
        // if (balance < 0) balance = 0; // Allow negative balance (anaerobic debt) for visualization? Usually clamped to 0.

        balanceStream.push(balance);
    }

    return balanceStream;
};

// Power Zones Definition (Coggan)

// Power Zones Definition (Coggan)
const ZONES = [
    { name: 'Z1 積極恢復', min: 0, max: 0.55, color: '#94a3b8', label: 'Recovery' },      // < 55%
    { name: 'Z2 耐力', min: 0.55, max: 0.75, color: '#3b82f6', label: 'Endurance' },     // 56 - 75%
    { name: 'Z3 節奏', min: 0.75, max: 0.90, color: '#10b981', label: 'Tempo' },         // 76 - 90%
    { name: 'Z4 閾值', min: 0.90, max: 1.05, color: '#f59e0b', label: 'Threshold' },     // 91 - 105%
    { name: 'Z5 最大攝氧', min: 1.05, max: 1.20, color: '#ef4444', label: 'VO2 Max' },    // 106 - 120%
    { name: 'Z6 無氧能力', min: 1.20, max: 1.50, color: '#8b5cf6', label: 'Anaerobic' },  // 121 - 150%
    { name: 'Z7 神經肌肉', min: 1.50, max: 10.0, color: '#a855f7', label: 'Neuromuscular' }, // > 150%
];

export const GoldenCheetahPage = () => {
    const { athlete, isBound } = useAuth();

    const [stravaZonesFromStream, setStravaZonesFromStream] = useState<StravaZoneBucket[] | null>(null);

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("正在載入...");
    const [streamLoadProgress, setStreamLoadProgress] = useState({ loaded: 0, total: 0 });
    const [displayProgress, setDisplayProgress] = useState(0);

    // 平滑進度動畫
    useEffect(() => {
        if (!loading) {
            setDisplayProgress(0);
            return;
        }

        const targetProgress = streamLoadProgress.total > 0
            ? (streamLoadProgress.loaded / streamLoadProgress.total) * 100
            : 0;

        if (displayProgress < targetProgress) {
            const timer = setTimeout(() => {
                setDisplayProgress(prev => Math.min(prev + 1, targetProgress));
            }, 10);
            return () => clearTimeout(timer);
        }
    }, [streamLoadProgress, loading, displayProgress]);
    const [searchQuery, setSearchQuery] = useState('');

    // Data
    const [latestActivity, setLatestActivity] = useState<StravaActivity | null>(null);
    const [allActivities, setAllActivities] = useState<StravaActivity[]>([]);
    const [allStreamsData, setAllStreamsData] = useState<Partial<StravaStreams>[]>([]);
    const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
    const [activeView, setActiveView] = useState<'dashboard' | 'aerolab' | 'compare'>('dashboard');
    const [activityStream, setActivityStream] = useState<number[]>([]);
    const [cadenceStream, setCadenceStream] = useState<number[]>([]);
    const [tempStream, setTempStream] = useState<number[]>([]);
    const [hrStream, setHrStream] = useState<number[]>([]);
    const [altitudeStream, setAltitudeStream] = useState<number[]>([]);

    const [athleteWeight, setAthleteWeight] = useState(70);
    const [athleteFTP, setAthleteFTP] = useState(250);
    const [athleteMaxHR] = useState(190);

    const [calculatedCP, setCalculatedCP] = useState(250);
    const [calculatedWPrime, setCalculatedWPrime] = useState(20000);

    // 圖表資料系列可見性切換
    const [chartVisibility, setChartVisibility] = useState({
        power: true,
        wBal: true,
        hr: true,
        altitude: true,
        cadence: false,
    });
    const toggleSeries = useCallback((key: keyof typeof chartVisibility) => {
        setChartVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // Sync Logic
    const [syncStatus, setSyncStatus] = useState<Record<number, 'idle' | 'syncing' | 'success' | 'error'>>({});
    const [lastSyncTime, setLastSyncTime] = useState<Record<number, number>>({});

    const handleSyncActivity = useCallback(async (activityId: number) => {
        const now = Date.now();
        const lastTime = lastSyncTime[activityId] || 0;
        if (syncStatus[activityId] === 'syncing' || (now - lastTime < 5000)) return;

        setSyncStatus(prev => ({ ...prev, [activityId]: 'syncing' }));
        setLastSyncTime(prev => ({ ...prev, [activityId]: now }));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const payload = {
                aspect_type: "create",
                event_time: Math.floor(Date.now() / 1000),
                object_id: Number(activityId),
                activity_id: Number(activityId),
                object_type: "activity",
                owner_id: athlete?.id,
                subscription_id: 0,
                updates: {}
            };

            const response = await fetch('https://service.criterium.tw/webhook/strava-activity-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Polling for data
                let retries = 0;
                const maxRetries = 20;

                const checkData = async (): Promise<boolean> => {
                    const { data: streamData } = await supabase
                        .from('strava_streams')
                        .select('activity_id, streams, max_heartrate, strava_zones')
                        .eq('activity_id', activityId)
                        .maybeSingle();

                    if (streamData) {
                        setSyncStatus(prev => ({ ...prev, [activityId]: 'success' }));

                        // Update local data
                        setAllStreamsData(prev => {
                            // Deduplicate
                            const others = prev.filter(s => s.activity_id !== activityId);
                            return [...others, streamData];
                        });

                        // If this is the currently selected activity, update it
                        if (selectedActivityId === activityId) {
                            if (streamData.streams) {
                                const streams = streamData.streams as StreamData[];
                                const watts = streams.find((s) => s.type === 'watts')?.data || [];
                                const cadence = streams.find((s) => s.type === 'cadence')?.data || [];
                                const temp = streams.find((s) => s.type === 'temp')?.data || [];
                                const heartrate = streams.find((s) => s.type === 'heartrate')?.data || [];
                                const altitude = streams.find((s) => s.type === 'altitude')?.data || [];

                                setActivityStream(watts);
                                setCadenceStream(cadence);
                                setTempStream(temp);
                                setHrStream(heartrate);
                                setAltitudeStream(altitude);
                                if (streamData.strava_zones) setStravaZonesFromStream(streamData.strava_zones);
                            }
                        }

                        setTimeout(() => {
                            setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' }));
                        }, 1000);
                        return true;
                    }
                    return false;
                };

                const poll = async () => {
                    if (retries >= maxRetries) {
                        setSyncStatus(prev => ({ ...prev, [activityId]: 'error' }));
                        setTimeout(() => setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' })), 3000);
                        return;
                    }

                    const found = await checkData();
                    if (!found) {
                        retries++;
                        setTimeout(poll, 2000);
                    }
                };

                poll();
            } else {
                throw new Error('Webhook call failed');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Sync failed:', error);
            setSyncStatus(prev => ({ ...prev, [activityId]: 'error' }));
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' })), 3000);
        }
    }, [athlete?.id, lastSyncTime, syncStatus, selectedActivityId]);

    /**
     * 切換活動：從快取的 streamsData 中載入指定活動的 stream 資料
     * @param activityId 要切換的活動 ID
     * @param activities 活動列表（可選，預設用 allActivities）
     * @param streamsCache streams 快取（可選，預設用 allStreamsData）
     */
    /**
     * 切換活動：從快取的 streamsData 中載入指定活動的 stream 資料
     */
    const updateLocalActivityStreams = useCallback((activityId: number, activities: StravaActivity[], streamsCache: Partial<StravaStreams>[]) => {
        const meta = activities.find(a => a.id === activityId);
        if (!meta) return;

        setLatestActivity(meta);
        setSelectedActivityId(activityId);

        const row = streamsCache.find((r: Partial<StravaStreams>) => r.activity_id === activityId);
        if (!row) {
            setActivityStream([]);
            setCadenceStream([]);
            setTempStream([]);
            setHrStream([]);
            setAltitudeStream([]);
            return;
        }

        // 設定 Max HR
        if (row.strava_zones) setStravaZonesFromStream(row.strava_zones);

        const activityStreams = row.streams as StreamData[] || [];
        const watts = activityStreams.find((s) => s.type === 'watts')?.data || [];
        const cadence = activityStreams.find((s) => s.type === 'cadence')?.data || [];
        const temp = activityStreams.find((s) => s.type === 'temp')?.data || [];
        const heartrate = activityStreams.find((s) => s.type === 'heartrate')?.data || [];
        const altitude = activityStreams.find((s) => s.type === 'altitude')?.data || [];

        setActivityStream(watts);
        setCadenceStream(cadence);
        setTempStream(temp);
        setHrStream(heartrate);
        setAltitudeStream(altitude);
    }, []);

    /**
     * 公共切換活動介面，依賴 allActivities 與 allStreamsData
     */
    const selectActivity = useCallback((activityId: number) => {
        updateLocalActivityStreams(activityId, allActivities, allStreamsData);
    }, [allActivities, allStreamsData, updateLocalActivityStreams]);

    // Fetch Data Logic
    const loadData = useCallback(async () => {
        if (!athlete?.id) return;
        setLoading(true);
        setStatusMessage("正在取得運動員資料...");

        try {
            // 1. Get Athlete Profile
            const { data: athleteData, error: profileError } = await supabase
                .from('athletes')
                .select('ftp, weight')
                .eq('id', athlete.id)
                .maybeSingle();

            if (profileError) {
                console.warn('[GoldenCheetah] 取得運動員基本資料失敗:', profileError);
                // 繼續執行，使用預設值
            }

            if (athleteData) {
                if (athleteData.ftp) setAthleteFTP(athleteData.ftp);
                if (athleteData.weight) setAthleteWeight(athleteData.weight);
            }

            // 2. Get Activities (Last 90 days for CP Model, Last 1 for Display)
            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0); // 固定時間部分，避免毫秒漂移引發重複更新
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            const { data: activityData, error: actError } = await supabase
                .from('strava_activities')
                .select('id, athlete_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, sport_type, start_date, average_watts, max_watts, average_heartrate, max_heartrate, suffer_score, average_speed, max_speed, average_cadence')
                .eq('athlete_id', athlete.id)
                .gte('start_date', cutoffDate.toISOString())
                .in('sport_type', ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide'])
                .order('start_date', { ascending: false });

            if (actError) throw actError;
            if (!activityData || activityData.length === 0) {
                setLoading(false);
                setStatusMessage("No Activities Found");
                return;
            }

            setStatusMessage("正在分析活動數據...");

            // 儲存所有活動清單
            setAllActivities(activityData);
            const latest = activityData[0];
            setSelectedActivityId(latest.id);

            // 3. 取得活動 Streams（前 20 筆用於 CP 模型計算）
            const activitiesToFetch = activityData.slice(0, 20);
            const totalToFetch = activitiesToFetch.length;
            setStreamLoadProgress({ loaded: 0, total: totalToFetch });

            const allFetchedStreams: any[] = [];
            const batchSize = 5;

            for (let i = 0; i < activitiesToFetch.length; i += batchSize) {
                const batchIds = activitiesToFetch.slice(i, i + batchSize).map(a => a.id);

                const { data: streamsData, error: streamsError } = await supabase
                    .from('strava_streams')
                    .select('activity_id, streams, max_heartrate, strava_zones')
                    .in('activity_id', batchIds);

                if (streamsError) throw streamsError;
                if (streamsData) {
                    allFetchedStreams.push(...streamsData);
                }

                setStreamLoadProgress(prev => ({
                    ...prev,
                    loaded: Math.min(i + batchSize, totalToFetch)
                }));
            }

            // 快取所有 streams 供後續切換使用
            setAllStreamsData(allFetchedStreams);

            // 提取 Power Streams 計算 CP 模型
            const powerArrays: number[][] = [];
            allFetchedStreams.forEach((row: Partial<StravaStreams>) => {
                const streams = row.streams as StreamData[] || [];
                const watts = streams.find((s) => s.type === 'watts')?.data;
                if (watts && watts.length > 0) powerArrays.push(watts);
            });

            // 使用 updateLocalActivityStreams 載入最新活動的 streams
            updateLocalActivityStreams(latest.id, activityData, allFetchedStreams);

            // 4. Calculate CP / W'
            if (powerArrays.length >= 3) {
                const mmp = calculateMMP(powerArrays);
                const model = fitMorton3P(mmp);
                if (model) {
                    setCalculatedCP(model.cp);
                    setCalculatedWPrime(model.wPrime);
                }
            }

        } catch (err: unknown) {
            console.error('[GoldenCheetah] loadData 失敗:', err);
            if (err instanceof Error) {
                setError(err.message);
                setStatusMessage(`Error: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [athlete?.id, updateLocalActivityStreams]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        // 頁面初始化完成後，不再需要點擊外部監聽（已移至 ActivitySelector）
    }, []);


    // ============================================
    // Derived Calculations using Memo
    // ============================================

    const wPrimeBalance = useMemo(() => {
        if (activityStream.length === 0) return [];
        return calculateWPrimeBalance(activityStream, calculatedCP, calculatedWPrime);
    }, [activityStream, calculatedCP, calculatedWPrime]);

    const chartData = useMemo(() => {
        if (activityStream.length === 0) return [];
        // Downsample for charts if too long (e.g. > 1 hour)
        // Keep visualization responsive
        const points = activityStream.length;
        const step = points > 7200 ? 10 : points > 3600 ? 5 : 1;

        const data = [];
        for (let i = 0; i < points; i += step) {
            data.push({
                time: i,
                timeLabel: new Date(i * 1000).toISOString().substr(11, 8),
                power: activityStream[i],
                wBal: wPrimeBalance[i] ? Math.round(wPrimeBalance[i] / 1000 * 10) / 10 : 0,
                hr: hrStream[i] || null,
                altitude: altitudeStream[i] ?? null,
                cadence: cadenceStream[i] || null,
            });
        }
        return data;
    }, [activityStream, wPrimeBalance, hrStream, altitudeStream, cadenceStream]);

    interface ZoneBucket {
        name: string;
        min: number;
        max: number;
        color: string;
        label: string;
        value: number;
        pct: number;
        range: string;
        seconds: number;
    }

    interface FatigueZone {
        name: string;
        label: string;
        description: string;
        minPct: number;
        maxPct: number;
        color: string;
        count: number;
        minJ: number;
        maxJ: number;
        pct: number;
        timeStr: string;
    }

    interface ActivitySummaryMetrics {
        tss: number;
        if: number;
        work: number;
        duration: number;
        np: number;
        avgPower: number;
        maxPower: number;
        timeAboveCP: number;
        timeAboveCPPct: number;
        zones: ZoneBucket[];
        zoneSource?: string;
        mmp20m: number;
        cadence: { avg: number; max: number; total: number };
        temp: { avg: number; min: number; max: number };
        hrZones: ZoneBucket[];
        isOfficialHrZones: boolean;
        vi: number;
        avgHR: number;
        maxHR: number;
        wPrimeWork: number;
        durationStr?: string;
    }

    // Metrics
    const summary = useMemo<ActivitySummaryMetrics>(() => {
        const hasPower = activityStream.length > 0;
        const hasHr = hrStream.length > 0;

        if (!hasPower && !hasHr) return {
            tss: 0, if: 0, work: 0, duration: 0, np: 0,
            avgPower: 0, maxPower: 0, timeAboveCP: 0, timeAboveCPPct: 0,
            zones: ZONES.map(z => ({ ...z, value: 0, count: 0, pct: 0, range: '', seconds: 0 })),
            mmp20m: 0,
            cadence: { avg: 0, max: 0, total: 0 },
            temp: { avg: 0, min: 0, max: 0 },
            hrZones: [],
            isOfficialHrZones: false,
            vi: 0,
            avgHR: 0,
            maxHR: 0,
            wPrimeWork: 0,
            durationStr: '00:00:00'
        };

        const duration = hasPower ? activityStream.length : hrStream.length;
        const avgPower = hasPower ? Math.round(activityStream.reduce((a, b) => a + b, 0) / duration) : 0;
        const maxPower = hasPower ? Math.max(...activityStream) : 0;
        const normPower = hasPower ? calculateNP(activityStream) : 0;
        const work = hasPower ? Math.round(activityStream.reduce((a, b) => a + b, 0) / 1000) : 0; // kJ

        // Calculate MMP 20m
        const mmpCurve = calculateMMP([activityStream]);
        const mmp20m = mmpCurve.find(p => p.duration === 1200)?.power || 0;

        // Calculate Cadence Metrics
        let cadAvg = 0, cadMax = 0, cadTotal = 0;
        if (cadenceStream.length > 0) {
            // Filter out zeros for average cadence? Usually yes for "Average Cadence" (cycling dynamics)
            // But strict average includes zeros. Garmin "Avg Cadence" usually excludes zeros.
            // Let's exclude zeros for Average calculation to match typical cycling head units.
            const nonZeroCadence = cadenceStream.filter(c => c > 0);
            if (nonZeroCadence.length > 0) {
                cadAvg = Math.round(nonZeroCadence.reduce((a, b) => a + b, 0) / nonZeroCadence.length);
            }
            cadMax = Math.max(...cadenceStream);
            // Total Strokes (Revolutions) = Sum(rpm / 60) assuming 1s interval
            cadTotal = Math.round(cadenceStream.reduce((a, b) => a + b, 0) / 60);
        }

        // Calculate Temperature Metrics
        let tempAvg = 0, tempMin = 0, tempMax = 0;
        if (tempStream.length > 0) {
            tempAvg = Math.round(tempStream.reduce((a, b) => a + b, 0) / tempStream.length * 10) / 10;
            tempMin = Math.min(...tempStream);
            tempMax = Math.max(...tempStream);
        }

        const intensityFactor = athleteFTP > 0 ? normPower / athleteFTP : 0;
        const tss = athleteFTP > 0 ? Math.round((duration * normPower * intensityFactor) / (athleteFTP * 3600) * 100) : 0;
        const vi = avgPower > 0 ? normPower / avgPower : 0;

        // Power Zones
        let powerZones: ZoneBucket[] = [];
        let powerZoneSource = '';

        const stravaActivityZones = latestActivity?.zones;

        // 1. Check for Standard Strava Zones Object (Activity Level)
        const stravaPowerZone = Array.isArray(stravaActivityZones)
            ? stravaActivityZones.find(z => z.type === 'power')
            : null;

        if (stravaPowerZone && stravaPowerZone.distribution_buckets) {
            // Use Strava Official Zones
            powerZoneSource = 'Strava Official';
            const totalPowerTime = stravaPowerZone.distribution_buckets.reduce((acc, b) => acc + (b.time || 0), 0);

            powerZones = stravaPowerZone.distribution_buckets.map((b, i) => {
                const timeValue = b.time || 0;
                // Safe access to ZONES[i] in case Strava has more/fewer buckets, though usually 7
                const zoneDef = ZONES[i] || { name: `Zone ${i + 1}`, color: '#cbd5e1', label: `Z${i + 1}` };

                return {
                    name: zoneDef.name,
                    min: b.min,
                    max: b.max,
                    color: zoneDef.color,
                    label: zoneDef.label,
                    value: timeValue,
                    pct: totalPowerTime > 0 ? Math.round((timeValue / totalPowerTime) * 1000) / 10 : 0,
                    range: `${b.min}-${b.max == -1 ? '+' : b.max} W`,
                    seconds: timeValue
                };
            });
        } else {
            // Fallback: Local Calculation
            powerZoneSource = `Based on MMP 20min (${mmp20m}W)`;
            const zonesHistogram = ZONES.map(z => ({ ...z, count: 0 }));
            activityStream.forEach(p => {
                const pct = athleteFTP > 0 ? p / athleteFTP : 0;
                const zoneIdx = ZONES.findIndex(z => pct >= z.min && pct < z.max);
                if (zoneIdx !== -1) zonesHistogram[zoneIdx].count += 1;
            });

            powerZones = zonesHistogram.map(z => ({
                ...z,
                value: z.count,
                pct: duration > 0 ? Math.round((z.count / duration) * 1000) / 10 : 0,
                range: `${Math.round(z.min * athleteFTP)}-${Math.round(z.max * athleteFTP)} W`,
                seconds: z.count
            }));
        }

        // Heart Rate Zones
        // Priority: Strava Official Zones (from Activity Response OR Stream Buckets) > Calculation by Max HR

        let hrZonesWithPct: (StravaZoneBucket & { name: string; label: string; value: number; pct: number; color: string })[] = [];
        let isOfficialHrZones = false;

        let targetBuckets: StravaZoneBucket[] | null = null;


        // 1. Check for Standard Strava Zones Object (Activity Level)
        const officialHrZone = Array.isArray(stravaActivityZones)
            ? stravaActivityZones.find(z => z.type === 'heartrate')
            : null;

        if (officialHrZone && officialHrZone.distribution_buckets) {
            targetBuckets = officialHrZone.distribution_buckets;
            isOfficialHrZones = true;
        }
        // 2. Check for "Buckets Array" from strava_streams (My new source)
        else if (stravaZonesFromStream && Array.isArray(stravaZonesFromStream)) {
            // Heuristic: Check if likely HR (Max bucket value < 260)
            // Strava Power zones can go up into hundreds/thousands. HR usually < 200.
            const maxVal = Math.max(...stravaZonesFromStream.map(b => b.max));
            // Also valid HR zone usually has min > 0 for at least some buckets
            if (maxVal > 0 && maxVal < 260) {
                targetBuckets = stravaZonesFromStream;
                isOfficialHrZones = true;
            }
        }

        const HR_COLORS = ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']; // Z1-Z5 Colors

        if (targetBuckets) {
            // Use Official Buckets
            const totalHrTime = targetBuckets.reduce((acc, b) => acc + (b.time || 0), 0);

            hrZonesWithPct = targetBuckets.map((b, i) => {
                const timeValue = b.time || 0;
                return {
                    name: `Z${i + 1}`,
                    min: b.min,
                    max: b.max,
                    label: `Zone ${i + 1}`,
                    count: timeValue,
                    value: timeValue,
                    pct: totalHrTime > 0 ? Math.round((timeValue / totalHrTime) * 1000) / 10 : 0,
                    color: HR_COLORS[i] || '#cbd5e1'
                };
            });
        } else {
            // Fallback: Local Calculation
            const HR_ZONES_DEF = [
                { name: 'Z1 恢復', min: 0.50, max: 0.60, color: '#9CA3AF' },   // 50-60% Recovery
                { name: 'Z2 有氧', min: 0.60, max: 0.70, color: '#60A5FA' },   // 60-70% Aerobic
                { name: 'Z3 節奏', min: 0.70, max: 0.80, color: '#34D399' },   // 70-80% Tempo
                { name: 'Z4 閾值', min: 0.80, max: 0.90, color: '#FBBF24' },   // 80-90% Threshold
                { name: 'Z5 無氧', min: 0.90, max: 2.0, color: '#EF4444' },    // > 90% Anaerobic
            ];

            const hrHistogram = HR_ZONES_DEF.map(z => ({ name: z.name, count: 0, color: z.color }));
            if (hrStream.length > 0) {
                hrStream.forEach(hr => {
                    const pct = athleteMaxHR > 0 ? hr / athleteMaxHR : 0;
                    const zoneIdx = HR_ZONES_DEF.findIndex(z => pct >= z.min && pct < z.max);
                    if (zoneIdx !== -1) hrHistogram[zoneIdx].count += 1;
                });
            }
            hrZonesWithPct = hrHistogram.map((z, i) => ({
                ...z,
                min: HR_ZONES_DEF[i].min,
                max: HR_ZONES_DEF[i].max,
                label: HR_ZONES_DEF[i].name,
                value: z.count,
                pct: Math.round((z.count / duration) * 1000) / 10
            }));
        }

        const timeAboveCPCount = activityStream.filter(p => p > calculatedCP).length;
        const timeAboveCPPct = Math.round((timeAboveCPCount / duration) * 100);

        // W' Work = 超過 CP 的總作功量 (kJ)
        const wPrimeWork = hasPower ? Math.round(activityStream.reduce((sum, p) => sum + Math.max(0, p - calculatedCP), 0) / 1000) : 0;



        const avgHR = Math.round(hrStream.length > 0 ? hrStream.reduce((a, b) => a + b, 0) / hrStream.length : 0);
        const maxHR = hrStream.length > 0 ? Math.max(...hrStream) : 0;

        return {
            duration,
            durationStr: new Date(duration * 1000).toISOString().substr(11, 8),
            avgPower,
            maxPower,
            np: Math.round(normPower),
            work,
            tss,
            if: intensityFactor,
            vi,
            avgHR,
            maxHR,
            timeAboveCP: timeAboveCPCount,
            timeAboveCPPct,

            zones: powerZones,
            zoneSource: powerZoneSource,
            mmp20m,
            cadence: { avg: cadAvg, max: cadMax, total: cadTotal },
            temp: { avg: tempAvg, min: tempMin, max: tempMax },
            hrZones: hrZonesWithPct as ZoneBucket[],
            isOfficialHrZones,
            wPrimeWork,
        };
    }, [activityStream, cadenceStream, tempStream, hrStream, athleteFTP, calculatedCP, athleteMaxHR, latestActivity, stravaZonesFromStream]);

    // ============================================
    // Fatigue Zones (W' Balance 疲勞分區 - GoldenCheetah 核心功能)
    // ============================================
    const fatigueZones = useMemo<FatigueZone[]>(() => {
        if (wPrimeBalance.length === 0 || calculatedWPrime <= 0) return [];
        const zones = [
            { name: 'W1', label: '恢復', description: 'Recovered', minPct: 0.75, maxPct: 1.0, color: '#34D399', count: 0, minJ: 0, maxJ: 0 },
            { name: 'W2', label: '中度疲勞', description: 'Moderate Fatigue', minPct: 0.50, maxPct: 0.75, color: '#FBBF24', count: 0, minJ: 0, maxJ: 0 },
            { name: 'W3', label: '重度疲勞', description: 'Heavy Fatigue', minPct: 0.25, maxPct: 0.50, color: '#F97316', count: 0, minJ: 0, maxJ: 0 },
            { name: 'W4', label: '嚴重疲勞', description: 'Severe Fatigue', minPct: 0.0, maxPct: 0.25, color: '#EF4444', count: 0, minJ: 0, maxJ: 0 },
        ];
        zones.forEach(z => {
            z.maxJ = Math.round(calculatedWPrime * z.maxPct);
            z.minJ = Math.round(calculatedWPrime * z.minPct);
        });
        wPrimeBalance.forEach(wBal => {
            const pct = wBal / calculatedWPrime;
            if (pct >= 0.75) zones[0].count++;
            else if (pct >= 0.50) zones[1].count++;
            else if (pct >= 0.25) zones[2].count++;
            else zones[3].count++;
        });
        const total = wPrimeBalance.length;
        return zones.map(z => ({
            ...z,
            pct: total > 0 ? Math.round((z.count / total) * 1000) / 10 : 0,
            timeStr: new Date(z.count * 1000).toISOString().substr(11, 8),
        }));
    }, [wPrimeBalance, calculatedWPrime]);

    // Max W' Expended Percentage
    const maxWExpendedPct = useMemo(() => {
        if (wPrimeBalance.length === 0 || calculatedWPrime <= 0) return 0;
        const minWBal = Math.min(...wPrimeBalance);
        return Math.round((1 - minWBal / calculatedWPrime) * 100);
    }, [wPrimeBalance, calculatedWPrime]);



    const selectAdjacentActivity = useCallback((direction: 'prev' | 'next') => {
        if (!selectedActivityId) return;
        const index = allActivities.findIndex(a => a.id === selectedActivityId);
        if (index === -1) return;

        const nextIndex = direction === 'next' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= allActivities.length) return;

        const nextActivity = allActivities[nextIndex];
        const row = allStreamsData.find(a => a.activity_id === nextActivity.id);

        if (row && row.streams) {
            selectActivity(nextActivity.id);
        } else {
            handleSyncActivity(nextActivity.id);
        }
    }, [selectedActivityId, allActivities, allStreamsData, selectActivity, handleSyncActivity]);

    // ============================================
    // Rendering
    // ============================================



    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center overflow-hidden relative max-w-sm w-full mx-4">
                    {/* 背景裝飾光暈 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <div className="relative w-16 h-16 mx-auto mb-6">
                            <Loader2 className="w-16 h-16 animate-spin text-yellow-500/20 absolute inset-0" strokeWidth={1} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-black text-yellow-400">
                                    {Math.round(displayProgress)}%
                                </span>
                            </div>
                        </div>

                        <p className="text-sm font-bold text-white mb-2 uppercase tracking-widest italic">{statusMessage}</p>
                        <p className="text-[10px] text-slate-500 mb-6 uppercase tracking-[0.2em]">GOLDENCHEETAH ENGINE INITIALIZING</p>

                        {streamLoadProgress.total > 0 && (
                            <div className="max-w-xs mx-auto">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">
                                    <span className="flex items-center gap-1.5 text-yellow-400/80">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                        STREAMS PROCESSING
                                    </span>
                                    <span>{streamLoadProgress.loaded} / {streamLoadProgress.total}</span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                        style={{ width: `${displayProgress}%` }}
                                    />
                                </div>
                                <p className="text-[9px] text-slate-600 mt-2 italic font-medium">Batch processing power metrics...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
                <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
                    <Info className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Oops! Something went wrong</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-bold transition-colors">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (error || !latestActivity) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-500">
                <Activity className="w-16 h-16 mb-4 opacity-20" />
                <h2 className="text-xl font-bold text-slate-300">No Activities Found</h2>
                <p className="mb-6">Please upload activities to Strava.</p>
                <Link to="/" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Link>
            </div>
        );
    }

    // Check if data is empty (Unsynced Activity)
    const hasData = activityStream.length > 0 || hrStream.length > 0;
    const currentSyncStatus = selectedActivityId ? (syncStatus[selectedActivityId] || 'idle') : 'idle';

    // ============================================
    // Main Render
    // ============================================

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f111a] text-slate-900 dark:text-slate-100 p-4 md:p-6 pb-20">
            {/* Header Area */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">

                    <ActivitySelector
                        latestActivity={latestActivity}
                        allActivities={allActivities}
                        allStreamsData={allStreamsData}
                        selectedActivityId={selectedActivityId}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectActivity={selectActivity}
                        handleNavigateActivity={selectAdjacentActivity}
                        handleSyncActivity={handleSyncActivity}
                        syncStatus={syncStatus}
                        hasData={hasData}
                        isBound={isBound}
                    />

                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3">
                    {!hasData && (
                        <button
                            onClick={() => selectedActivityId && handleSyncActivity(selectedActivityId)}
                            disabled={currentSyncStatus === 'syncing'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentSyncStatus === 'syncing'
                                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95"
                                }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${currentSyncStatus === 'syncing' ? "animate-spin" : ""}`} />
                            {currentSyncStatus === 'syncing' ? '同步中...' : '同步數據'}
                        </button>
                    )}

                    {hasData && (
                        <div className="flex items-center bg-slate-900/50 rounded-xl p-1 border border-slate-800/50">
                            <button
                                onClick={() => setActiveView('dashboard')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'dashboard'
                                    ? "bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20"
                                    : "text-slate-400 hover:text-slate-200"
                                    }`}
                            >
                                Dashboard
                            </button>

                            {/* Aerolab Tab - Gated */}
                            <div className="relative group">
                                <button
                                    onClick={() => isBound && setActiveView('aerolab')}
                                    disabled={!isBound}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeView === 'aerolab'
                                        ? "bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20"
                                        : !isBound
                                            ? "text-slate-600 cursor-not-allowed"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                >
                                    Aerolab
                                    {!isBound && <Lock className="w-3 h-3" />}
                                </button>
                                {!isBound && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                        僅限綁定會員
                                    </div>
                                )}
                            </div>

                            {/* Compare Tab - Gated */}
                            <div className="relative group">
                                <button
                                    onClick={() => isBound && setActiveView('compare')}
                                    disabled={!isBound}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeView === 'compare'
                                        ? "bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20"
                                        : !isBound
                                            ? "text-slate-600 cursor-not-allowed"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                >
                                    Compare
                                    {!isBound && <Lock className="w-3 h-3" />}
                                </button>
                                {!isBound && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                        僅限綁定會員
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Content Grid */}
            {activeView === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min">
                    {/* 1. Summary Metrics */}
                    <PerformanceSummary summary={summary} athleteWeight={athleteWeight} />

                    {/* 2. Stat Overview Row */}
                    <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Totals Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" /> Totals
                            </h4>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400">Duration</span><span className="font-mono font-bold">{summary.durationStr}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Time Moving</span><span className="font-mono font-bold">{latestActivity.moving_time ? new Date(latestActivity.moving_time * 1000).toISOString().substr(11, 8) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Distance (km)</span><span className="font-mono font-bold">{latestActivity.distance ? (latestActivity.distance / 1000).toFixed(1) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Work (kJ)</span><span className="font-mono font-bold">{summary.work}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">W' Work (kJ)</span><span className="font-mono font-bold text-purple-400">{summary.wPrimeWork}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Elevation (m)</span><span className="font-mono font-bold">{latestActivity.total_elevation_gain ? Math.round(latestActivity.total_elevation_gain) : '–'}</span></div>
                            </div>
                        </div>

                        {/* Averages Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5" /> Averages
                            </h4>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400">Athlete Weight (kg)</span><span className="font-mono font-bold">{athleteWeight}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Avg Speed (kph)</span><span className="font-mono font-bold">{latestActivity.average_speed ? (latestActivity.average_speed * 3.6).toFixed(1) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Avg Power (W)</span><span className="font-mono font-bold">{summary.avgPower}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Avg Heart Rate (bpm)</span><span className="font-mono font-bold">{latestActivity.average_heartrate ? Math.round(latestActivity.average_heartrate) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Avg Cadence (rpm)</span><span className="font-mono font-bold">{latestActivity.average_cadence ? Math.round(latestActivity.average_cadence) : '–'}</span></div>
                            </div>
                        </div>

                        {/* Maxima Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" /> Maximum
                            </h4>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400">Max Speed (kph)</span><span className="font-mono font-bold">{latestActivity.max_speed ? (latestActivity.max_speed * 3.6).toFixed(1) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Max Power (W)</span><span className="font-mono font-bold">{summary.maxPower}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Max Heart Rate (bpm)</span><span className="font-mono font-bold">{latestActivity.max_heartrate ? Math.round(latestActivity.max_heartrate) : '–'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Max Cadence (rpm)</span><span className="font-mono font-bold">{summary.cadence.max}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Max W' Expended (%)</span><span className="font-mono font-bold text-red-400">{maxWExpendedPct}%</span></div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Gauges Row */}
                    <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <GaugeChart value={calculatedCP} min={100} max={400} label="CP Estimate" unit="watts" color="#EAB308" subLabel={`${(calculatedCP / athleteWeight).toFixed(1)} W/kg`} />
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <GaugeChart value={calculatedWPrime / 1000} min={5} max={45} label="W' Estimate" unit="kJ" color="#A855F7" decimals={1} />
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <GaugeChart value={athleteWeight} min={50} max={120} label="Weight" unit="kg" color="#3B82F6" decimals={1} />
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <GaugeChart value={latestActivity.suffer_score || 0} min={0} max={300} label="Suffer Score" unit="points" color="#EF4444" subLabel={latestActivity.suffer_score ? (latestActivity.suffer_score > 150 ? "Hard" : latestActivity.suffer_score > 50 ? "Moderate" : "Easy") : "N/A"} />
                        </div>
                    </div>

                    {/* 4. Main Evolution Chart */}
                    <MainAnalysisChart
                        hasData={hasData}
                        currentSyncStatus={currentSyncStatus}
                        handleSyncActivity={handleSyncActivity}
                        selectedActivityId={selectedActivityId}
                        chartVisibility={chartVisibility}
                        toggleSeries={toggleSeries}
                        chartData={chartData}
                        calculatedCP={calculatedCP}
                        calculatedWPrime={calculatedWPrime}
                        hrStream={hrStream}
                        altitudeStream={altitudeStream}
                        cadenceStream={cadenceStream}
                    />

                    {/* 5. Distribution Row */}
                    <div className="md:col-span-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                        <ZoneDistribution zones={summary.zones} mmp20m={summary.mmp20m} source={summary.zoneSource} />

                        <div className="flex-1 flex flex-col border-t border-slate-800 pt-6 mt-4 min-h-[220px]">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                                <Heart className="w-4 h-4 text-red-500" />
                                Heart Rate Zones {summary.isOfficialHrZones ? <span className="text-orange-400 text-[10px] border border-orange-400/30 px-1 rounded">STRAVA OFFICIAL</span> : `(Max: ${athleteMaxHR})`}
                            </h3>
                            <p className="text-xs text-slate-400 mb-2">
                                {summary.isOfficialHrZones
                                    ? "使用 Strava 官方分析的心率區間數據。"
                                    : `基於最大心率 (${athleteMaxHR} bpm) 計算。`}
                            </p>
                            <div className="flex-1 w-full min-h-0">
                                {summary.hrZones.reduce((a: number, b: ZoneBucket) => a + (b.value || 0), 0) > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={summary.hrZones}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                                            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                                <LabelList dataKey="pct" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ""} fill="#94a3b8" fontSize={10} />
                                                {summary.hrZones.map((entry: ZoneBucket, index: number) => (
                                                    <Cell key={`cell-hr-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                                        No Heart Rate Data
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-500" />
                                Activity Details
                            </h3>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 text-sm py-2 border-b border-slate-800 items-center">
                                    <span className="text-slate-400">Activity Name</span>
                                    <span className="font-bold text-white truncate text-center pl-2">{latestActivity.name}</span>
                                </div>
                                <div className="grid grid-cols-2 text-sm py-2 border-b border-slate-800 items-center">
                                    <span className="text-slate-400">Max Power</span>
                                    <span className="font-bold text-white text-center">{summary.maxPower} W</span>
                                </div>
                                <div className="grid grid-cols-2 text-sm py-2 border-b border-slate-800 items-center">
                                    <span className="text-slate-400">Avg Power</span>
                                    <span className="font-bold text-white text-center">{summary.avgPower} W</span>
                                </div>
                                <div className="grid grid-cols-2 text-sm py-2 border-b border-slate-800 items-center">
                                    <span className="text-slate-400">Weight Setting</span>
                                    <span className="font-bold text-white text-center">{athleteWeight} kg</span>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                <span className="text-slate-500">Watts/kg</span>
                                <span className="font-mono font-bold text-white">{(summary.maxPower / (athleteWeight || 70)).toFixed(2)} W/kg</span>
                            </div>

                            {summary.cadence.total > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <RotateCw className="w-3 h-3" /> 踏頻 (Cadence)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                            <div className="text-[10px] text-slate-500 uppercase">Avg RPM</div>
                                            <div className="text-xl font-bold text-white">{summary.cadence.avg} <span className="text-xs text-slate-600">rpm</span></div>
                                        </div>
                                        <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                            <div className="text-[10px] text-slate-500 uppercase">Max RPM</div>
                                            <div className="text-xl font-bold text-white">{summary.cadence.max} <span className="text-xs text-slate-600">rpm</span></div>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                        <div className="text-[10px] text-slate-500 uppercase">Total Strokes</div>
                                        <div className="text-xl font-bold text-white">{summary.cadence.total.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            {summary.temp.avg !== 0 && (
                                <div className="mt-6">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <Thermometer className="w-3 h-3" /> 溫度 (Temp)
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-2 bg-white/5 dark:bg-black/20 rounded-lg text-center">
                                            <div className="text-[9px] text-slate-500 uppercase">Avg</div>
                                            <div className="text-sm font-bold text-white">{summary.temp.avg}°</div>
                                        </div>
                                        <div className="p-2 bg-white/5 dark:bg-black/20 rounded-lg text-center">
                                            <div className="text-[9px] text-slate-500 uppercase">Min</div>
                                            <div className="text-sm font-bold text-blue-400">{summary.temp.min}°</div>
                                        </div>
                                        <div className="p-2 bg-white/5 dark:bg-black/20 rounded-lg text-center">
                                            <div className="text-[9px] text-slate-500 uppercase">Max</div>
                                            <div className="text-sm font-bold text-red-400">{summary.temp.max}°</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 6. Advanced Metrics Row */}
                    {fatigueZones.length > 0 && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-orange-500" />
                                    W' Fatigue Zones
                                </h3>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={fatigueZones} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
                                            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                                            <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} width={30} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                                                formatter={(value: number, name: string, item: { payload?: { timeStr?: string; label?: string } }) => {
                                                    const payload = item.payload;
                                                    if (name === 'power' && chartVisibility.power) return [`${value} W`, 'Power'];
                                                    if (name === 'wBal' && chartVisibility.wBal) return [`${value} kJ`, "W' Bal"];
                                                    if (name === 'hr' && chartVisibility.hr) return [`${value} bpm`, 'Heart Rate'];
                                                    if (name === 'altitude' && chartVisibility.altitude) return [`${value} m`, 'Altitude'];
                                                    if (name === 'cadence' && chartVisibility.cadence) return [`${value} rpm`, 'Cadence'];
                                                    return [
                                                        `${value}% (${payload?.timeStr || ''})`,
                                                        payload?.label || ''
                                                    ];
                                                }}
                                            />
                                            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="pct" position="right" formatter={(val: number) => val > 0 ? `${val}%` : ""} fill="#94a3b8" fontSize={10} />
                                                {fatigueZones.map((entry, index) => (
                                                    <Cell key={`fatigue-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    Fatigue Details
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                                                <th className="py-2 text-left">Zone</th>
                                                <th className="py-2 text-right">Low</th>
                                                <th className="py-2 text-right">High</th>
                                                <th className="py-2 text-right">Time</th>
                                                <th className="py-2 text-right">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fatigueZones.map((z) => (
                                                <tr key={z.name} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                                                    <td className="py-2 font-bold" style={{ color: z.color }}>{z.name}</td>
                                                    <td className="py-2 text-right font-mono text-slate-400">{z.minJ}</td>
                                                    <td className="py-2 text-right font-mono text-slate-400">{z.maxJ}</td>
                                                    <td className="py-2 text-right font-mono">{z.timeStr}</td>
                                                    <td className="py-2 text-right font-mono font-bold">{z.pct}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {latestActivity.description && (
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                            <FileText className="w-3 h-3" /> Notes
                                        </h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{latestActivity.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeView === 'aerolab' && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center border border-slate-700">
                        <h3 className="text-xl font-bold text-white mb-2">Aerolab Coming Soon</h3>
                        <p>Virtual Elevation analysis features are under development.</p>
                    </div>
                </div>
            )}

            {activeView === 'compare' && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center border border-slate-700">
                        <h3 className="text-xl font-bold text-white mb-2">Compare Mode Coming Soon</h3>
                        <p>Activity comparison features are under development.</p>
                    </div>
                </div>
            )}


            {/* Footer Area */}
            <footer className="mt-8 border-t border-slate-800 pt-6 text-center">
                <p className="text-xs text-slate-500 font-mono">
                    Based on <a href="https://github.com/GoldenCheetah/GoldenCheetah" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white underline">GoldenCheetah</a> (GPL v2).
                    Algorithms adapted for web visualization.
                </p>
                <p className="text-[10px] text-slate-600 mt-1">
                    Power & W' Balance model uses Skiba (2012) / Froncioni integral method (Tau=570s).
                </p>
            </footer>
        </div>
    );
};

export default GoldenCheetahPage;
