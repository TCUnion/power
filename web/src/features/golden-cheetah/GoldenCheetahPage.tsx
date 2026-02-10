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
 * This implementation adapts the core concepts for a web-based React application.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
    Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, ComposedChart, BarChart, Bar, Cell, LabelList
} from 'recharts';
import { Activity, Dumbbell, Zap, TrendingUp, Scale, Info, Loader2, ArrowLeft, Thermometer, RotateCw, Timer, Heart, Clock, Gauge, FileText, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { fitMorton3P, calculateMMP, calculateNP } from '../../utils/power-models';
import { GaugeChart } from './GaugeChart';

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

// ============================================
// Helper Components
// ============================================
interface MetricCardProps {
    title: string;
    value: number | string;
    unit?: string;
    icon?: React.ElementType;
    color?: string;
    subValue?: string;
}

const MetricCard = ({ title, value, unit, icon: Icon, color = "text-slate-200", subValue }: MetricCardProps) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center h-full">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
            {Icon && <Icon className={`w-4 h-4 ${color} opacity-80`} />}
        </div>
        <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${color}`}>{value}</span>
            {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
        </div>
        {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
);

// Power Zones Definition (Coggan)
const ZONES = [
    { name: 'Z1 積極恢復', min: 0, max: 0.55, color: '#94a3b8' },      // < 55%
    { name: 'Z2 耐力', min: 0.55, max: 0.75, color: '#3b82f6' },      // 56 - 75%
    { name: 'Z3 節奏', min: 0.75, max: 0.90, color: '#10b981' },      // 76 - 90%
    { name: 'Z4 閾值', min: 0.90, max: 1.05, color: '#f59e0b' },      // 91 - 105%
    { name: 'Z5 最大攝氧', min: 1.05, max: 1.20, color: '#ef4444' },    // 106 - 120%
    { name: 'Z6 無氧能力', min: 1.20, max: 1.50, color: '#8b5cf6' },    // 121 - 150%
    { name: 'Z7 神經肌肉', min: 1.50, max: 10.0, color: '#a855f7' },    // > 150%
];

export const GoldenCheetahPage = () => {
    const { athlete } = useAuth();
    const navigate = useNavigate();
    const [stravaZonesFromStream, setStravaZonesFromStream] = useState<any[] | null>(null);

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("Initializing...");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Data
    const [latestActivity, setLatestActivity] = useState<any>(null);
    const [allActivities, setAllActivities] = useState<any[]>([]);
    const [allStreamsData, setAllStreamsData] = useState<any[]>([]);
    const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
    const [activityStream, setActivityStream] = useState<number[]>([]);
    const [cadenceStream, setCadenceStream] = useState<number[]>([]);
    const [tempStream, setTempStream] = useState<number[]>([]);
    const [hrStream, setHrStream] = useState<number[]>([]);
    const [altitudeStream, setAltitudeStream] = useState<number[]>([]);
    const [athleteFTP, setAthleteFTP] = useState(250);

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
    const [athleteMaxHR, setAthleteMaxHR] = useState(190);
    const [athleteWeight, setAthleteWeight] = useState(70);
    const [calculatedCP, setCalculatedCP] = useState(250);
    const [calculatedWPrime, setCalculatedWPrime] = useState(20000);

    // Sync Logic
    const [syncStatus, setSyncStatus] = useState<Record<number, 'idle' | 'syncing' | 'success' | 'error'>>({});
    const [lastSyncTime, setLastSyncTime] = useState<Record<number, number>>({});

    const handleSyncActivity = async (activityId: number) => {
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
                            // Trigger a re-select to refresh streams
                            // We need to access the LATEST allStreamsData, so we use the functional update result logic implicitly
                            // effectively manually setting the streams here for immediate feedback
                            if (streamData.streams) {
                                const watts = streamData.streams.find((s: any) => s.type === 'watts')?.data || [];
                                const cadence = streamData.streams.find((s: any) => s.type === 'cadence')?.data || [];
                                const temp = streamData.streams.find((s: any) => s.type === 'temp')?.data || [];
                                const heartrate = streamData.streams.find((s: any) => s.type === 'heartrate')?.data || [];
                                const altitude = streamData.streams.find((s: any) => s.type === 'altitude')?.data || [];

                                setActivityStream(watts);
                                setCadenceStream(cadence);
                                setTempStream(temp);
                                setHrStream(heartrate);
                                setAltitudeStream(altitude);
                                if (streamData.max_heartrate) setAthleteMaxHR(streamData.max_heartrate);
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
    };

    /**
     * 切換活動：從快取的 streamsData 中載入指定活動的 stream 資料
     * @param activityId 要切換的活動 ID
     * @param activities 活動列表（可選，預設用 allActivities）
     * @param streamsCache streams 快取（可選，預設用 allStreamsData）
     */
    const selectActivity = useCallback((activityId: number, activities?: any[], streamsCache?: any[]) => {
        const acts = activities || allActivities;
        const streams = streamsCache || allStreamsData;
        const meta = acts.find((a: any) => a.id === activityId);
        if (!meta) return;

        setLatestActivity(meta);
        setSelectedActivityId(activityId);
        setIsDropdownOpen(false);

        const row = streams.find((r: any) => r.activity_id === activityId);
        if (!row) {
            setActivityStream([]);
            setCadenceStream([]);
            setTempStream([]);
            setHrStream([]);
            setAltitudeStream([]);
            return;
        }

        // 設定 Max HR
        if (row.max_heartrate) setAthleteMaxHR(row.max_heartrate);
        if (row.strava_zones) setStravaZonesFromStream(row.strava_zones);

        const watts = row.streams?.find((s: any) => s.type === 'watts')?.data || [];
        const cadence = row.streams?.find((s: any) => s.type === 'cadence')?.data || [];
        const temp = row.streams?.find((s: any) => s.type === 'temp')?.data || [];
        const heartrate = row.streams?.find((s: any) => s.type === 'heartrate')?.data || [];
        const altitude = row.streams?.find((s: any) => s.type === 'altitude')?.data || [];

        setActivityStream(watts);
        setCadenceStream(cadence);
        setTempStream(temp);
        setHrStream(heartrate);
        setAltitudeStream(altitude);
    }, [allActivities, allStreamsData]);

    // Fetch Data Logic
    const loadData = useCallback(async () => {
        if (!athlete?.id) return;
        setLoading(true);
        setStatusMessage("Loading athlete profile...");

        try {
            // 1. Get Athlete Profile
            const { data: athleteData } = await supabase
                .from('athletes')
                .select('ftp, weight')
                .eq('id', athlete.id)
                .maybeSingle();

            const ftp = athleteData?.ftp || 250;
            const weight = athleteData?.weight || 70;
            setAthleteFTP(ftp);
            setAthleteWeight(weight);

            // 2. Get Activities (Last 90 days for CP Model, Last 1 for Display)
            setStatusMessage("Fetching activity history...");
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            const { data: activityData, error: actError } = await supabase
                .from('strava_activities')
                .select('*')
                .eq('athlete_id', athlete.id)
                .gte('start_date', cutoffDate.toISOString())
                .in('sport_type', ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide'])
                .order('start_date', { ascending: false });

            if (actError) throw actError;
            if (!activityData || activityData.length === 0) {
                setLoading(false);
                return;
            }

            // 儲存所有活動清單
            setAllActivities(activityData);
            const latest = activityData[0];
            setSelectedActivityId(latest.id);

            // 3. 取得活動 Streams（前 20 筆用於 CP 模型計算）
            setStatusMessage("Analyzing power data...");

            const activitiesToFetch = activityData.slice(0, 20);
            const activityIds = activitiesToFetch.map(a => a.id);

            const { data: streamsData, error: streamsError } = await supabase
                .from('strava_streams')
                .select('activity_id, streams, max_heartrate, strava_zones')
                .in('activity_id', activityIds);

            if (streamsError) throw streamsError;
            if (!streamsData) {
                setLoading(false);
                return;
            }

            // 快取所有 streams 供後續切換使用
            setAllStreamsData(streamsData);

            // 提取 Power Streams 計算 CP 模型
            const powerArrays: number[][] = [];
            streamsData.forEach((row: { activity_id: number; streams: any[] }) => {
                const watts = row.streams?.find((s: any) => s.type === 'watts')?.data;
                if (watts && watts.length > 0) powerArrays.push(watts);
            });

            // 使用 selectActivity 載入最新活動的 streams
            selectActivity(latest.id, activityData, streamsData);

            // 4. Calculate CP / W'
            if (powerArrays.length >= 3) {
                const mmp = calculateMMP(powerArrays);
                const model = fitMorton3P(mmp);
                if (model) {
                    setCalculatedCP(model.cp);
                    setCalculatedWPrime(model.wPrime);
                }
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [athlete?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
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

    // Metrics
    const summary = useMemo(() => {
        const hasPower = activityStream.length > 0;
        const hasHr = hrStream.length > 0;

        if (!hasPower && !hasHr) return {
            tss: 0, if: 0, work: 0, duration: 0, normPower: 0,
            avgPower: 0, maxPower: 0, timeAboveCP: 0, timeAboveCPPct: 0, timeAboveCPFraction: 0,
            zones: ZONES.map(z => ({ ...z, value: 0, pct: 0 })),
            mmp20m: 0,
            cadence: { avg: 0, max: 0, total: 0 },
            temp: { avg: 0, min: 0, max: 0 },
            hrZones: [] as any[],
            isOfficialHrZones: false,
            vi: 0
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
        const zonesHistogram = ZONES.map(z => ({ name: z.name, count: 0, color: z.color }));
        activityStream.forEach(p => {
            const pct = athleteFTP > 0 ? p / athleteFTP : 0;
            const zoneIdx = ZONES.findIndex(z => pct >= z.min && pct < z.max);
            if (zoneIdx !== -1) zonesHistogram[zoneIdx].count += 1;
        });

        // Heart Rate Zones
        // Priority: Strava Official Zones (from Activity Response OR Stream Buckets) > Calculation by Max HR

        let hrZonesWithPct: any[] = [];
        let isOfficialHrZones = false;

        let targetBuckets: any[] | null = null;
        const stravaActivityZones = (latestActivity as any)?.zones;

        // 1. Check for Standard Strava Zones Object (Activity Level)
        const officialHrZone = Array.isArray(stravaActivityZones)
            ? stravaActivityZones.find((z: any) => z.type === 'heartrate')
            : null;

        if (officialHrZone && officialHrZone.distribution_buckets) {
            targetBuckets = officialHrZone.distribution_buckets;
            isOfficialHrZones = true;
        }
        // 2. Check for "Buckets Array" from strava_streams (My new source)
        else if (stravaZonesFromStream && Array.isArray(stravaZonesFromStream)) {
            // Heuristic: Check if likely HR (Max bucket value < 260)
            // Strava Power zones can go up into hundreds/thousands. HR usually < 200.
            const maxVal = Math.max(...stravaZonesFromStream.map((b: any) => b.max));
            // Also valid HR zone usually has min > 0 for at least some buckets
            if (maxVal > 0 && maxVal < 260) {
                targetBuckets = stravaZonesFromStream;
                isOfficialHrZones = true;
            }
        }

        const HR_COLORS = ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']; // Z1-Z5 Colors

        if (targetBuckets) {
            // Use Official Buckets
            const totalHrTime = targetBuckets.reduce((acc: number, b: any) => acc + b.time, 0);

            hrZonesWithPct = targetBuckets.map((b: any, i: number) => {
                // Determine Label (Z1, Z2, or Custom Name if available?)
                // Strava buckets don't always have names.
                return {
                    name: `Z${i + 1}`,
                    min: b.min,
                    max: b.max,
                    count: b.time,
                    pct: totalHrTime > 0 ? Math.round((b.time / totalHrTime) * 1000) / 10 : 0,
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
            hrZonesWithPct = hrHistogram.map(z => ({ ...z, pct: Math.round((z.count / duration) * 1000) / 10 }));
        }

        const timeAboveCPCount = activityStream.filter(p => p > calculatedCP).length;
        const timeAboveCPPct = Math.round((timeAboveCPCount / duration) * 100);
        const timeAboveCPFraction = timeAboveCPCount > 0 ? Math.round(timeAboveCPCount / 60) : 0; // Convert to minutes for display

        // W' Work = 超過 CP 的總作功量 (kJ)
        const wPrimeWork = hasPower ? Math.round(activityStream.reduce((sum, p) => sum + Math.max(0, p - calculatedCP), 0) / 1000) : 0;

        const zonesWithPct = zonesHistogram.map(z => ({ ...z, pct: Math.round((z.count / duration) * 1000) / 10 }));

        return {
            duration,
            durationStr: new Date(duration * 1000).toISOString().substr(11, 8),
            avgPower,
            maxPower,
            normPower: Math.round(normPower),
            work,
            tss,
            if: intensityFactor,
            vi,
            timeAboveCP: timeAboveCPCount,
            timeAboveCPPct,
            timeAboveCPFraction,

            zones: zonesWithPct,
            mmp20m,
            cadence: { avg: cadAvg, max: cadMax, total: cadTotal },
            temp: { avg: tempAvg, min: tempMin, max: tempMax },
            hrZones: hrZonesWithPct,
            isOfficialHrZones,
            wPrimeWork,
        };
    }, [activityStream, cadenceStream, tempStream, hrStream, athleteFTP, calculatedCP, athleteMaxHR, latestActivity, stravaZonesFromStream]);

    // ============================================
    // Fatigue Zones (W' Balance 疲勞分區 - GoldenCheetah 核心功能)
    // ============================================
    const fatigueZones = useMemo(() => {
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

    const filteredActivities = useMemo(() => {
        if (!searchQuery) return allActivities;
        const lower = searchQuery.toLowerCase();
        return allActivities.filter((a: any) =>
            a.name.toLowerCase().includes(lower)
        );
    }, [allActivities, searchQuery]);

    const handleNavigateActivity = useCallback((direction: 'prev' | 'next') => {
        if (!selectedActivityId || filteredActivities.length === 0) return;
        const idx = filteredActivities.findIndex((a: any) => a.id === selectedActivityId);
        if (idx === -1) return;

        // "prev" means older activity (next in list), "next" means newer activity (prev in list)
        const newIdx = direction === 'prev' ? idx + 1 : idx - 1;

        if (newIdx >= 0 && newIdx < filteredActivities.length) {
            selectActivity(filteredActivities[newIdx].id);
        }
    }, [filteredActivities, selectedActivityId, selectActivity]);

    // ============================================
    // Rendering
    // ============================================

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin text-yellow-500 mb-4" />
                <p className="font-mono text-sm animate-pulse">{statusMessage}</p>
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
    const currentSyncStatus = selectedActivityId ? syncStatus[selectedActivityId] : 'idle';

    // ============================================
    // Main Render
    // ============================================

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f111a] text-slate-900 dark:text-slate-100 p-4 md:p-6 pb-20">
            {/* Header */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 bg-slate-900/50 p-2 pr-4 rounded-xl border border-slate-800/50">
                    <button
                        onClick={() => navigate('/power')}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors group"
                        title="返回"
                    >
                        <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white" />
                    </button>

                    {/* Activity Selector (The "Table" user refers to) */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-3 px-4 py-2 bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-all border border-slate-700/50 min-w-[280px] sm:min-w-[320px] max-w-[500px]"
                        >
                            <div className="flex flex-col items-start truncate flex-1">
                                <span className={`text-sm font-bold truncate w-full ${!hasData ? 'text-slate-400' : 'text-white'}`}>
                                    {latestActivity.name}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                                    <span>{format(new Date(latestActivity.start_date), 'yyyy-MM-dd HH:mm')}</span>
                                    <span>•</span>
                                    <span>{(latestActivity.distance / 1000).toFixed(1)}km</span>
                                    {!hasData && (
                                        <span className="flex items-center gap-1 text-orange-400 ml-2 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                            <Info className="w-3 h-3" /> 未同步
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full sm:w-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[600px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                <div className="p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="搜尋活動名稱..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto flex-1 custom-scrollbar">
                                    {filteredActivities.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 text-xs">
                                            無法找到符合的活動
                                        </div>
                                    ) : (
                                        filteredActivities.map((act: any) => {
                                            const hasStream = allStreamsData.some((s: any) => s.activity_id === act.id);
                                            const isSelected = act.id === selectedActivityId;
                                            return (
                                                <button
                                                    key={act.id}
                                                    onClick={() => selectActivity(act.id)}
                                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition cursor-pointer border-b border-slate-800/50 last:border-0 ${isSelected
                                                        ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500'
                                                        : 'hover:bg-slate-800/60'
                                                        }`}
                                                >
                                                    <div className="text-xs text-slate-500 font-mono w-[80px] flex-shrink-0">
                                                        {format(new Date(act.start_date), 'MM/dd HH:mm')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm truncate ${isSelected ? 'text-yellow-400 font-bold' : 'text-slate-200'}`}>
                                                            {act.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex gap-3 mt-0.5 items-center">
                                                            <span>{(act.distance / 1000).toFixed(1)} km</span>
                                                            <span>{new Date(act.moving_time * 1000).toISOString().substr(11, 8)}</span>
                                                            {!hasStream && (
                                                                <span className="text-orange-400 flex items-center gap-1 ml-auto">
                                                                    {syncStatus[act.id] === 'syncing' ? (
                                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <Info className="w-3 h-3" />
                                                                    )}
                                                                    {syncStatus[act.id] === 'syncing' ? '同步中' : '無數據'}
                                                                </span>
                                                            )}
                                                            {hasStream && act.average_watts && <span>{act.average_watts}W avg</span>}
                                                        </div>
                                                    </div>
                                                    {isSelected && !hasStream && syncStatus[act.id] !== 'syncing' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSyncActivity(act.id);
                                                            }}
                                                            className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"
                                                            title="立即同步"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* 快速切換按鈕 */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700/50 hidden sm:flex">
                        <button
                            onClick={() => handleNavigateActivity('prev')}
                            disabled={filteredActivities.findIndex((a: any) => a.id === selectedActivityId) >= filteredActivities.length - 1}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleNavigateActivity('next')}
                            disabled={filteredActivities.findIndex((a: any) => a.id === selectedActivityId) <= 0}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    {/* Sync Button (Visible if unsynced) */}
                    {!hasData && (
                        <button
                            onClick={() => selectedActivityId && handleSyncActivity(selectedActivityId)}
                            disabled={currentSyncStatus === 'syncing'}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all
                                ${currentSyncStatus === 'syncing'
                                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${currentSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                            {currentSyncStatus === 'syncing' ? '同步中...' : '同步數據'}
                        </button>
                    )}

                    {hasData && (
                        <div className="flex items-center bg-slate-900/50 rounded-xl p-1 border border-slate-800/50">
                            <button className="px-3 py-1.5 rounded-lg bg-yellow-500 text-slate-900 text-xs font-bold shadow-lg shadow-yellow-500/20">
                                Dashboard
                            </button>
                            <button className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors">
                                Aerolab
                            </button>
                            <button className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors">
                                Compare
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min">

                {/* Summary Cards */}
                <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                    <MetricCard
                        title="TSS"
                        value={summary.tss}
                        icon={Activity}
                        color="text-yellow-400"
                        subValue={`IF: ${(Math.round(summary.if * 100) / 100).toFixed(2)}`}
                    />
                    <MetricCard
                        title="WORK"
                        value={summary.work}
                        unit="kJ"
                        icon={Dumbbell}
                        color="text-purple-400"
                        subValue={format(new Date(0, 0, 0, 0, 0, summary.duration), 'HH:mm:ss')}
                    />
                    <MetricCard
                        title="MMP 20min"
                        value={summary.mmp20m}
                        unit="W"
                        icon={Timer}
                        color="text-orange-400"
                        subValue={athleteWeight > 0 ? `${(summary.mmp20m / athleteWeight).toFixed(1)} W/kg` : undefined}
                    />

                    <MetricCard
                        title="NORMALIZED POWER"
                        value={summary.normPower}
                        unit="W"
                        icon={Zap}
                        color="text-emerald-400"
                        subValue={`Avg: ${summary.avgPower}W`}
                    />
                    <MetricCard
                        title="TIME > CP"
                        value={summary.timeAboveCPPct}
                        unit="%"
                        icon={TrendingUp}
                        color="text-red-400"
                        subValue={summary.timeAboveCP > 0 ? `${(summary.timeAboveCPFraction ?? 0).toFixed(0)} CP Efforts` : "No Anaerobic Work"}
                    />
                    <MetricCard
                        title="VI"
                        value={summary.vi.toFixed(2)}
                        icon={Scale}
                        color="text-pink-400"
                        subValue="Variability Index"
                    />
                </div>

                {/* Totals / Averages / Maximum (GoldenCheetah Style) */}
                <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Totals */}
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
                    {/* Averages */}
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
                    {/* Maximum */}
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

                {/* CP / W' / Weight / Suffer Score Gauges */}
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
                        <GaugeChart value={latestActivity.suffer_score || 0} min={0} max={300} label="Suffer Score" unit="points" color="#EF4444" subLabel={latestActivity.suffer_score ? (latestActivity.suffer_score > 150 ? 'Hard' : latestActivity.suffer_score > 50 ? 'Moderate' : 'Easy') : 'N/A'} />
                    </div>
                </div>

                {/* 2. Main Chart: Power & W' Balance */}
                <div className="md:col-span-12 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 min-h-[400px] flex flex-col relative overflow-hidden">

                    {/* Sync Overlay */}
                    {!hasData && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 text-center animate-in fade-in duration-500">
                            <div className="bg-slate-800 p-5 rounded-full mb-4 shadow-xl border border-slate-700 relative">
                                <RefreshCw className={`w-10 h-10 text-blue-500 ${currentSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                                {currentSyncStatus === 'success' && <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full"><CheckCircle className="w-4 h-4" /></div>}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {currentSyncStatus === 'syncing' ? '正在同步數據...' : '需要同步資料'}
                            </h3>
                            <p className="text-slate-200 mb-6 text-sm max-w-sm">
                                {currentSyncStatus === 'syncing'
                                    ? '正在抓取功率與心率數據，請稍候...'
                                    : '此活動尚未有詳細串流數據，無法進行功率分析。'
                                }
                            </p>

                            {currentSyncStatus === 'idle' || currentSyncStatus === 'error' ? (
                                <button
                                    onClick={() => selectedActivityId && handleSyncActivity(selectedActivityId)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 text-sm"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    立即同步
                                </button>
                            ) : (
                                <div className="px-6 py-2.5 bg-slate-800 text-slate-400 font-bold rounded-lg cursor-not-allowed flex items-center gap-2 text-sm border border-slate-700">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    同步中...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Existing Chart Header */}
                    <div className={`flex justify-between items-center mb-4 transition-all duration-500 ${!hasData ? 'opacity-10 blur-[2px]' : ''}`}>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            Power & W' Balance
                        </h3>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                            <button onClick={() => toggleSeries('power')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.power ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'opacity-30 hover:opacity-50'}`}>
                                <span className="w-3 h-3 bg-yellow-500/50 rounded-sm"></span>
                                Power (W)
                            </button>
                            <button onClick={() => toggleSeries('wBal')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.wBal ? 'bg-purple-500/10 hover:bg-purple-500/20' : 'opacity-30 hover:opacity-50'}`}>
                                <span className="w-3 h-0.5 bg-purple-500"></span>
                                W' Bal (kJ)
                            </button>
                            {hrStream.length > 0 && (
                                <button onClick={() => toggleSeries('hr')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.hr ? 'bg-red-400/10 hover:bg-red-400/20' : 'opacity-30 hover:opacity-50'}`}>
                                    <span className="w-3 h-0.5 bg-red-400"></span>
                                    HR (bpm)
                                </button>
                            )}
                            {altitudeStream.length > 0 && (
                                <button onClick={() => toggleSeries('altitude')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.altitude ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'opacity-30 hover:opacity-50'}`}>
                                    <span className="w-3 h-3 bg-emerald-500/30 rounded-sm"></span>
                                    Altitude (m)
                                </button>
                            )}
                            {cadenceStream.length > 0 && (
                                <button onClick={() => toggleSeries('cadence')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.cadence ? 'bg-cyan-400/10 hover:bg-cyan-400/20' : 'opacity-30 hover:opacity-50'}`}>
                                    <span className="w-3 h-0.5 bg-cyan-400"></span>
                                    Cadence (rpm)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={`flex-1 w-full min-h-[350px] transition-all duration-500 ${!hasData ? 'opacity-10 blur-[2px] pointer-events-none' : ''}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                <XAxis
                                    dataKey="timeLabel"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    minTickGap={50}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 10 }}
                                    domain={[0, 'auto']}
                                    label={{ value: 'Watts', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#a855f7"
                                    tick={{ fontSize: 10 }}
                                    domain={[0, Math.ceil(calculatedWPrime / 1000)]}
                                    label={{ value: "W' (kJ)", angle: 90, position: 'insideRight', fill: '#a855f7', fontSize: 10 }}
                                />
                                {/* 隱藏軸：心率 / 海拔 / 踏頻 */}
                                <YAxis yAxisId="hr" orientation="right" hide domain={[60, 220]} />
                                <YAxis yAxisId="altitude" orientation="right" hide domain={['dataMin - 50', 'dataMax + 50']} />
                                <YAxis yAxisId="cadence" orientation="right" hide domain={[0, 150]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                                    formatter={(value: any, name: string) => {
                                        if (name === 'power' && chartVisibility.power) return [`${value} W`, 'Power'];
                                        if (name === 'wBal' && chartVisibility.wBal) return [`${value} kJ`, "W' Bal"];
                                        if (name === 'hr' && chartVisibility.hr) return [`${value} bpm`, 'Heart Rate'];
                                        if (name === 'altitude' && chartVisibility.altitude) return [`${value} m`, 'Altitude'];
                                        if (name === 'cadence' && chartVisibility.cadence) return [`${value} rpm`, 'Cadence'];
                                        return [null, null];
                                    }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                {/* CP Reference */}
                                <ReferenceLine yAxisId="left" y={calculatedCP} stroke="#EF4444" strokeDasharray="3 3" opacity={0.5} label={{ value: 'CP', fill: '#EF4444', fontSize: 10, position: 'insideLeft' }} />

                                {/* 海拔填充區域（綠色，置於底層） */}
                                {chartVisibility.altitude && altitudeStream.length > 0 && (
                                    <Area
                                        yAxisId="altitude"
                                        type="monotone"
                                        dataKey="altitude"
                                        stroke="#10B981"
                                        fill="url(#altitudeGradient)"
                                        strokeWidth={1}
                                        isAnimationActive={false}
                                        opacity={0.6}
                                    />
                                )}

                                {/* Power 功率區域 */}
                                {chartVisibility.power && (
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="power"
                                        stroke="#EAB308"
                                        fill="url(#powerGradient)"
                                        strokeWidth={1}
                                        isAnimationActive={false}
                                    />
                                )}

                                {/* W' Balance 曲線 */}
                                {chartVisibility.wBal && (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="wBal"
                                        stroke="#A855F7"
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                )}

                                {/* 心率曲線 */}
                                {chartVisibility.hr && hrStream.length > 0 && (
                                    <Line
                                        yAxisId="hr"
                                        type="monotone"
                                        dataKey="hr"
                                        stroke="#F87171"
                                        strokeWidth={1}
                                        dot={false}
                                        isAnimationActive={false}
                                        opacity={0.4}
                                    />
                                )}

                                {/* 踏頻曲線 */}
                                {chartVisibility.cadence && cadenceStream.length > 0 && (
                                    <Line
                                        yAxisId="cadence"
                                        type="monotone"
                                        dataKey="cadence"
                                        stroke="#22D3EE"
                                        strokeWidth={1}
                                        dot={false}
                                        isAnimationActive={false}
                                        opacity={0.5}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Bottom Row: Zones & Details */}
                <div className="md:col-span-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">

                    {/* Power Zones */}
                    <div className="flex-1 flex flex-col min-h-[220px]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                            <Scale className="w-4 h-4 text-emerald-500" />
                            Power Zones Distribution
                        </h3>
                        <p className="text-xs text-slate-400 mb-2">
                            基於 FTP 設定 ({athleteFTP}W) 計算，顯示各功率區間的時間分佈。
                        </p>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summary.zones}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="pct" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ''} fill="#94a3b8" fontSize={10} />
                                        {summary.zones.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Heart Rate Zones */}
                    <div className="flex-1 flex flex-col border-t border-slate-800 pt-6 mt-4 min-h-[220px]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-500" />
                            Heart Rate Zones {summary.isOfficialHrZones ? <span className="text-orange-400 text-[10px] border border-orange-400/30 px-1 rounded">STRAVA OFFICIAL</span> : `(Max: ${athleteMaxHR})`}
                        </h3>
                        <p className="text-xs text-slate-400 mb-2">
                            {summary.isOfficialHrZones
                                ? "使用 Strava 官方分析的心率區間數據。"
                                : `基於最大心率 (${athleteMaxHR} bpm) 計算，監控心血管強度與訓練負荷。`}
                        </p>
                        <div className="flex-1 w-full min-h-0">
                            {summary.hrZones.reduce((a: number, b: any) => a + b.count, 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={summary.hrZones}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                                        <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="pct" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ''} fill="#94a3b8" fontSize={10} />
                                            {summary.hrZones.map((entry: any, index: number) => (
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
                                <span className="font-bold text-white truncate text-center">{latestActivity.name}</span>
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
                        <div className="flex items-center justify-between p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                            <span className="text-slate-500">Watts/kg</span>
                            <span className="font-mono font-bold text-white">{(summary.maxPower / athleteWeight).toFixed(2)} W/kg</span>
                        </div>

                        {/* Cadence Section */}
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
                                    <div className="text-[10px] text-slate-500 uppercase">Total Strokes (總圈數)</div>
                                    <div className="text-xl font-bold text-white">{summary.cadence.total.toLocaleString()}</div>
                                </div>
                            </div>
                        )}

                        {/* Temperature Section */}
                        {summary.temp.avg !== 0 && (
                            <div className="mt-6">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                    <Thermometer className="w-3 h-3" /> 溫度 (Temperature)
                                </h4>
                                <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg mb-3">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-[10px] text-slate-500 uppercase">Avg Temp</div>
                                        <div className="text-xl font-bold text-white">{summary.temp.avg} <span className="text-xs text-slate-600">°C</span></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                        <div className="text-[10px] text-slate-500 uppercase">Min Temp</div>
                                        <div className="text-xl font-bold text-blue-400">{summary.temp.min} <span className="text-xs text-slate-600">°C</span></div>
                                    </div>
                                    <div className="p-3 bg-white/5 dark:bg-black/20 rounded-lg">
                                        <div className="text-[10px] text-slate-500 uppercase">Max Temp</div>
                                        <div className="text-xl font-bold text-red-400">{summary.temp.max} <span className="text-xs text-slate-600">°C</span></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Fatigue Zones (W' Balance Distribution) - GoldenCheetah 核心功能 */}
                {
                    fatigueZones.length > 0 && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fatigue Zones Bar Chart */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-orange-500" />
                                    W' Fatigue Zones
                                </h3>
                                <p className="text-xs text-slate-400 mb-3">
                                    根據 W' Balance 剩餘量分析疲勞分佈，數值越低代表疲勞程度越高。
                                </p>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={fatigueZones} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
                                            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                                            <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} width={30} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                                                formatter={(val: number, _: string, props: any) => [`${val}% (${props.payload.timeStr})`, props.payload.label]}
                                            />
                                            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="pct" position="right" formatter={(val: number) => val > 0 ? `${val}%` : ''} fill="#94a3b8" fontSize={10} />
                                                {fatigueZones.map((entry, index) => (
                                                    <Cell key={`fatigue-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Fatigue Zones Table + Notes */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    Fatigue Zone Details
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                                                <th className="py-2 text-left">Zone</th>
                                                <th className="py-2 text-left">Description</th>
                                                <th className="py-2 text-right">Low (J)</th>
                                                <th className="py-2 text-right">High (J)</th>
                                                <th className="py-2 text-right">Time</th>
                                                <th className="py-2 text-right">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fatigueZones.map((z) => (
                                                <tr key={z.name} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                                                    <td className="py-2 font-bold" style={{ color: z.color }}>{z.name}</td>
                                                    <td className="py-2 text-slate-300">{z.label}</td>
                                                    <td className="py-2 text-right font-mono text-slate-400">{z.minJ}</td>
                                                    <td className="py-2 text-right font-mono text-slate-400">{z.maxJ}</td>
                                                    <td className="py-2 text-right font-mono">{z.timeStr}</td>
                                                    <td className="py-2 text-right font-mono font-bold">{z.pct}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Notes / 活動描述 */}
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
                    )
                }

            </div >

            {/* Footer / Copyright */}
            < footer className="mt-8 border-t border-slate-800 pt-6 text-center" >
                <p className="text-xs text-slate-500 font-mono">
                    Based on <a href="https://github.com/GoldenCheetah/GoldenCheetah" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white underline">GoldenCheetah</a> (GPL v2).
                    Algorithms adapted for web visualization.
                </p>
                <p className="text-[10px] text-slate-600 mt-1">
                    Power & W' Balance model uses Skiba (2012) / Froncioni integral method (Tau=570s).
                </p>
            </footer >
        </div >
    );
};

export default GoldenCheetahPage;
