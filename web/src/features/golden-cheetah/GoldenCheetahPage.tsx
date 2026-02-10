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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
    Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, ComposedChart, BarChart, Bar, Cell, LabelList
} from 'recharts';
import { Activity, Dumbbell, Zap, TrendingUp, Scale, Info, Loader2, ArrowLeft, Thermometer, RotateCw, Timer, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { fitMorton3P, calculateMMP, calculateNP } from '../../utils/power-models';

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
    const [stravaZonesFromStream, setStravaZonesFromStream] = useState<any[] | null>(null);

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("Initializing...");

    // Data
    const [latestActivity, setLatestActivity] = useState<any>(null); // TODO: Type this properly with StravaActivity
    const [activityStream, setActivityStream] = useState<number[]>([]);
    const [cadenceStream, setCadenceStream] = useState<number[]>([]);
    const [tempStream, setTempStream] = useState<number[]>([]);
    const [hrStream, setHrStream] = useState<number[]>([]);
    const [athleteFTP, setAthleteFTP] = useState(250);
    const [athleteMaxHR, setAthleteMaxHR] = useState(190); // Default Max HR
    const [athleteWeight, setAthleteWeight] = useState(70);
    const [calculatedCP, setCalculatedCP] = useState(250);
    const [calculatedWPrime, setCalculatedWPrime] = useState(20000);

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

            // Set Latest Activity Metadata
            const latest = activityData[0];
            setLatestActivity(latest);

            // 3. Fetch Streams for CP Calculation (Batch)
            // Ideally we need all streams, but to save bandwidth let's fetch:
            // - Latest Activity Stream (Full)
            // - Top 20 Activities Streams (for decent CP estimation)
            setStatusMessage("Analyzing power data...");

            const activitiesToFetch = activityData.slice(0, 20); // Limit to 20 for performance
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

            // Set Max HR priority: Activity Stream > Athlete Profile > Default
            const latestStreamRow = streamsData.find((row: any) => row.activity_id === latest.id);

            // Set Strava Zones from Stream (Distribution Buckets)
            if (latestStreamRow?.strava_zones) {
                setStravaZonesFromStream(latestStreamRow.strava_zones);
            } else {
                setStravaZonesFromStream(null);
            }

            if (latestStreamRow?.max_heartrate) {
                setAthleteMaxHR(latestStreamRow.max_heartrate);
            } else if (latest.athlete_id) {
                // Fetch Athlete Profile Fallback
                const { data: athleteData } = await supabase
                    .from('athletes')
                    .select('max_heartrate')
                    .eq('id', latest.athlete_id)
                    .maybeSingle();

                if (athleteData && athleteData.max_heartrate) {
                    setAthleteMaxHR(athleteData.max_heartrate);
                }
            }

            // Extract Power Streams
            const powerArrays: number[][] = [];
            let latestStream: number[] = [];

            streamsData.forEach((row: { activity_id: number; streams: any[] }) => {
                const watts = row.streams?.find((s: any) => s.type === 'watts')?.data;
                if (watts && watts.length > 0) {
                    powerArrays.push(watts);
                    if (row.activity_id === latest.id) {
                        latestStream = watts;
                        // Extract other streams for the latest activity
                        const cadence = row.streams?.find((s: any) => s.type === 'cadence')?.data;
                        const temp = row.streams?.find((s: any) => s.type === 'temp')?.data;
                        const heartrate = row.streams?.find((s: any) => s.type === 'heartrate')?.data;

                        if (cadence) setCadenceStream(cadence); else setCadenceStream([]);
                        if (temp) setTempStream(temp); else setTempStream([]);
                        if (heartrate) setHrStream(heartrate); else setHrStream([]);
                    }
                }
            });

            if (latestStream.length === 0) {
                // Latest activity has no power data, fallback?
                // Try to find the first one that has power
                const hasPower = streamsData.find((d: { activity_id: number, streams: any[] }) => {
                    const w = d.streams?.find((s: any) => s.type === 'watts')?.data;
                    return w && w.length > 0;
                });
                if (hasPower) {
                    const w = hasPower.streams?.find((s: any) => s.type === 'watts')?.data;
                    latestStream = w;
                    const meta = activityData.find(a => a.id === hasPower.activity_id);
                    if (meta) setLatestActivity(meta); // Update metadata to match stream
                }
            }

            setActivityStream(latestStream);

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
            });
        }
        return data;
    }, [activityStream, wPrimeBalance]);

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
                { name: 'Z1 基礎', min: 0, max: 0.65, color: '#94a3b8' },      // < 65% Endurance
                { name: 'Z2 中等', min: 0.65, max: 0.75, color: '#3b82f6' },   // 65-75% Moderate
                { name: 'Z3 節奏', min: 0.75, max: 0.85, color: '#10b981' },   // 75-85% Tempo
                { name: 'Z4 閾值', min: 0.85, max: 0.95, color: '#f59e0b' },   // 85-95% Threshold
                { name: 'Z5 無氧', min: 0.95, max: 2.0, color: '#ef4444' },    // > 95% Anaerobic
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
            isOfficialHrZones
        };
    }, [activityStream, cadenceStream, tempStream, hrStream, athleteFTP, calculatedCP, athleteMaxHR, latestActivity, stravaZonesFromStream]);

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

    if (error || !summary || !latestActivity) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-500">
                <Activity className="w-16 h-16 mb-4 opacity-20" />
                <h2 className="text-xl font-bold text-slate-300">No Analytics Available</h2>
                <p className="mb-6">We couldn't load activity data for GoldenCheetah analysis.</p>
                <Link to="/" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f111a] text-slate-900 dark:text-slate-100 p-4 md:p-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-2">
                        <span className="text-yellow-500">GOLDEN</span> CHEETAH <span className="text-slate-400 text-sm font-normal normal-case not-italic tracking-normal px-2 bg-slate-800 rounded-full">Dashboard View</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-mono flex items-center gap-2">
                        <span className="text-white font-bold">{latestActivity.name}</span>
                        <span>•</span>
                        {format(new Date(latestActivity.start_date), 'yyyy-MM-dd HH:mm')}
                    </p>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <Link to="/power" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition mr-2">
                        <ArrowLeft className="w-4 h-4 text-slate-400" />
                    </Link>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-yellow-500 font-bold">CP: {Math.round(calculatedCP)}W</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-purple-400 font-bold">W': {(calculatedWPrime / 1000).toFixed(1)}kJ</span>
                        <span className="text-slate-600">|</span>
                        <span>FTP: {athleteFTP}W</span>
                    </div>
                </div>
            </div>

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

                {/* 2. Main Chart: Power & W' Balance */}
                <div className="md:col-span-12 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 min-h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            Power & W' Balance
                        </h3>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-yellow-500/50 rounded-sm"></span>
                                Power (W)
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-0.5 bg-purple-500"></span>
                                W' Bal (kJ)
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0.1} />
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
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                                    formatter={(value: any, name: string) => {
                                        if (name === 'power') return [`${value} W`, 'Power'];
                                        if (name === 'wBal') return [`${value} kJ`, "W' Bal"];
                                        return [value, name];
                                    }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                {/* CP Reference */}
                                <ReferenceLine yAxisId="left" y={calculatedCP} stroke="#EF4444" strokeDasharray="3 3" opacity={0.5} label={{ value: 'CP', fill: '#EF4444', fontSize: 10, position: 'insideLeft' }} />

                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="power"
                                    stroke="#EAB308"
                                    fill="url(#powerGradient)"
                                    strokeWidth={1}
                                    isAnimationActive={false}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="wBal"
                                    stroke="#A855F7"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                />
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

            </div>

            {/* Footer / Copyright */}
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
