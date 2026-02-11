/**
 * 功率進階分析頁面 (Power Analysis Page)
 *
 * 提供 Dashboard 之外的深度功率分析功能：
 * - MMP (Mean Maximal Power) 曲線與 Power-Duration Curve
 * - Morton's 3-Parameter Critical Power 模型擬合
 * - 功率剖面 (Coggan Power Profile) 分級
 * - FTP 歷史趨勢追蹤
 * - 週 TSS 訓練量統計
 *
 * 參考資源：
 * @see https://github.com/velozs/cycling-analytics — Velozs Cycling Analytics
 * @see https://github.com/GoldenCheetah/GoldenCheetah — GoldenCheetah
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft, Zap, TrendingUp, BarChart3, Target,
    Activity, Loader2, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePowerAnalysis } from '../../hooks/usePowerAnalysis';
import type { StravaActivity } from '../../types';

import { MMPChart } from './components/MMPChart';
import { FTPTrendChart } from './components/FTPTrendChart';
import { TrainingVolumeChart } from './components/TrainingVolumeChart';
import { PMCChart } from '../../components/charts/PMCChart';

// 分頁標籤定義
type TabKey = 'mmp' | 'ftp' | 'volume' | 'pmc';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; description: string }[] = [
    { key: 'mmp', label: 'MMP / CP 模型', icon: <TrendingUp className="w-4 h-4" />, description: '功率-時間曲線與 Critical Power 擬合' },
    { key: 'ftp', label: 'FTP 趨勢', icon: <Target className="w-4 h-4" />, description: '功能閾值功率歷史變化' },
    { key: 'volume', label: '訓練量', icon: <BarChart3 className="w-4 h-4" />, description: '週 TSS 累積與訓練負荷等級' },
    { key: 'pmc', label: '體能管理', icon: <Activity className="w-4 h-4" />, description: 'CTL / ATL / TSB 長期趨勢' },
];

const PowerAnalysisPage: React.FC = () => {
    const { athlete, isBound } = useAuth();
    const { calculateNP, calculateTSS } = usePowerAnalysis();

    // 頁面狀態
    const [activeTab, setActiveTab] = useState<TabKey>('mmp');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 數據狀態
    const [activities, setActivities] = useState<StravaActivity[]>([]);
    const [currentFTP, setCurrentFTP] = useState(0);
    const [athleteWeight, setAthleteWeight] = useState(0);
    const [streamLoadProgress, setStreamLoadProgress] = useState({ loaded: 0, total: 0 });
    const [analyzedActivityIds, setAnalyzedActivityIds] = useState<Set<number>>(new Set());
    const [activityPowerData, setActivityPowerData] = useState<{ date: string; data: number[] }[]>([]);
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

    // FTP 歷史數據
    const [ftpHistory, setFtpHistory] = useState<{ date: string; ftp: number; source: 'recorded' | 'estimated' }[]>([]);

    // 每日 TSS 數據
    const [dailyTSSData, setDailyTSSData] = useState<{ date: string; tss: number; activityCount: number }[]>([]);

    // 分析區間控制 (42, 84, 180, 365)
    // 預設對認證會員使用 365 天以確保圖表數據完整，非認證限制為 42 天
    const [analysisRange, setAnalysisRange] = useState<number>(isBound ? 365 : 42);

    // 權限變動時自動調整分析區間
    // 首次確認為認證會員時，自動將預設範圍擴展至 365D 以確保圖表完整
    useEffect(() => {
        if (isBound && analysisRange === 42) {
            setAnalysisRange(365);
        } else if (!isBound && analysisRange !== 42) {
            setAnalysisRange(42);
        }
    }, [isBound]);

    /**
     * 載入活動數據與 Streams
     * 
     * 流程：
     * 1. 從 Supabase 取得指定時間範圍內的活動
     * 2. 取得選手 FTP、體重
     * 3. 批量載入 Streams 提取功率數據
     * 4. 計算每日 TSS 與 FTP 歷史
     */
    const loadAnalysisData = useCallback(async () => {
        if (!athlete?.id) return;

        setLoading(true);
        setError(null);

        try {
            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0);

            // 抓取範圍：認證會員一律抓取 365 天以確保圖表（52週訓練量）數據完整
            // 非認證會員受限於 42 天
            const fetchDays = isBound ? 365 : 42;
            cutoffDate.setDate(cutoffDate.getDate() - fetchDays);

            // 取得選手資訊（FTP 與體重）
            const { data: athleteData } = await supabase
                .from('athletes')
                .select('ftp, weight')
                .eq('id', athlete.id)
                .maybeSingle();

            const ftp = athleteData?.ftp || 0;
            const weight = athleteData?.weight || 70;
            setCurrentFTP(ftp);
            setAthleteWeight(weight);

            // 取得活動列表（僅騎乘類型）
            const { data: activityData, error: actError } = await supabase
                .from('strava_activities')
                .select('id, athlete_id, name, type, sport_type, start_date, elapsed_time, moving_time, average_watts, max_watts, distance, total_elevation_gain')
                .eq('athlete_id', athlete.id)
                .gte('start_date', cutoffDate.toISOString())
                .in('sport_type', ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide'])
                .order('start_date', { ascending: false })
                .limit(1000);

            if (actError) throw actError;
            const acts = activityData || [];
            setActivities(acts);

            if (acts.length === 0) {
                setLoading(false);
                return;
            }

            // 批量取得所有 Streams（分批處理避免超時）
            const allPowerData: { date: string; data: number[] }[] = [];
            const ftpHist: typeof ftpHistory = [];
            const analyzedIds = new Set<number>();
            const dailyTSS: Record<string, { tss: number; count: number }> = {};

            // 預先填充所有活動，確保計數正確（即使沒有 Streams）
            acts.forEach(act => {
                const dateKey = new Date(act.start_date).toISOString().split('T')[0];
                if (!dailyTSS[dateKey]) {
                    dailyTSS[dateKey] = { tss: 0, count: 0 };
                }
                dailyTSS[dateKey].count += 1;

                // 如果有平均功率但沒處理到 Streams，先做一個初步 TSS 估算
                // 後續若有 Streams 資料會被精確計算覆蓋或疊加
                if (act.average_watts && act.average_watts > 0 && ftp > 0) {
                    const intensity = act.average_watts / ftp;
                    const duration = act.elapsed_time || act.moving_time;
                    const estimatedTSS = (duration * act.average_watts * intensity) / (ftp * 3600) * 100;
                    dailyTSS[dateKey].tss += estimatedTSS;
                }
            });

            const batchSize = 20;
            const totalBatches = Math.ceil(acts.length / batchSize);
            setStreamLoadProgress({ loaded: 0, total: acts.length });

            for (let batch = 0; batch < totalBatches; batch++) {
                const batchActs = acts.slice(batch * batchSize, (batch + 1) * batchSize);
                const batchIds = batchActs.map(a => a.id);

                const { data: streamsData } = await supabase
                    .from('strava_streams')
                    .select('activity_id, streams, ftp')
                    .in('activity_id', batchIds);

                if (streamsData) {
                    for (const stream of streamsData) {
                        const act = batchActs.find(a => a.id === stream.activity_id);
                        if (!act) continue;

                        const wattsStream = stream.streams?.find((s: { type: string; data: number[] }) => s.type === 'watts');
                        const wattsData = wattsStream?.data;

                        if (wattsData && wattsData.length > 0) {
                            allPowerData.push({ date: act.start_date, data: wattsData });


                            if (stream.ftp && stream.ftp > 0) {
                                ftpHist.push({
                                    date: act.start_date,
                                    ftp: stream.ftp,
                                    source: 'recorded',
                                });
                            }

                            const effectiveFtp = stream.ftp || ftp;
                            if (effectiveFtp > 0) {
                                const np = calculateNP(wattsData);
                                const duration = act.elapsed_time || act.moving_time;
                                const tss = calculateTSS(np, effectiveFtp, duration);

                                const dateKey = new Date(act.start_date).toISOString().split('T')[0];

                                let baseTSS = 0;
                                if (act.average_watts && act.average_watts > 0) {
                                    const intensity = act.average_watts / effectiveFtp;
                                    baseTSS = (duration * act.average_watts * intensity) / (effectiveFtp * 3600) * 100;
                                }

                                if (dailyTSS[dateKey]) {
                                    dailyTSS[dateKey].tss = Math.max(0, dailyTSS[dateKey].tss - baseTSS + tss);
                                }
                                analyzedIds.add(act.id);
                            }
                        }
                    }
                }
                setStreamLoadProgress({ loaded: Math.min((batch + 1) * batchSize, acts.length), total: acts.length });
            }

            setActivityPowerData(allPowerData);
            setFtpHistory(ftpHist);
            setAnalyzedActivityIds(analyzedIds);
            setDailyTSSData(
                Object.entries(dailyTSS)
                    .map(([date, data]) => ({ date, tss: Math.round(data.tss), activityCount: data.count }))
                    .sort((a, b) => a.date.localeCompare(b.date))
            );
        } catch (err: unknown) {
            console.error('載入分析數據失敗:', err);
            setError(err instanceof Error ? err.message : '載入數據時發生錯誤');
        } finally {
            setLoading(false);
        }
    }, [athlete?.id, isBound, calculateNP, calculateTSS]);

    useEffect(() => {
        loadAnalysisData();
    }, [loadAnalysisData]);

    // 統計摘要數據 (依據選定的分析區間過濾)
    const summaryStats = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - analysisRange);

        const filteredActs = activities.filter(a => new Date(a.start_date) >= cutoff);
        const totalActivities = filteredActs.length;
        const activitiesWithStreams = filteredActs.filter(a => analyzedActivityIds.has(a.id)).length;
        const totalDistance = filteredActs.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
        const totalElevation = filteredActs.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
        const totalTime = filteredActs.reduce((sum, a) => sum + (a.moving_time || 0), 0);
        const avgPower = filteredActs.reduce((sum, a) => sum + (a.average_watts || 0), 0) / (totalActivities || 1);

        return {
            totalActivities,
            activitiesWithStreams,
            totalDistance: Math.round(totalDistance),
            totalElevation: Math.round(totalElevation),
            totalTime,
            avgPower: Math.round(avgPower),
        };
    }, [activities, analysisRange, analyzedActivityIds]);

    // MMP 視圖所需的數據：當前區間 vs 參考區間 (365D)
    const mmpViewData = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - analysisRange);

        const currentPowerArrays = activityPowerData
            .filter(ap => new Date(ap.date) >= cutoff)
            .map(ap => ap.data);

        const referencePowerArrays = activityPowerData.map(ap => ap.data);

        return {
            current: currentPowerArrays,
            reference: referencePowerArrays
        };
    }, [activityPowerData, analysisRange]);

    // 格式化騎乘總時間
    const formatTotalTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* ====== Header ====== */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/power"
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black italic uppercase text-white flex items-center gap-2">
                                <Zap className="w-6 h-6 text-orange-500" />
                                Power Analysis
                            </h1>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5">
                                Advanced Metrics — MMP · CP Model · Power Profile
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">

                        <button
                            onClick={loadAnalysisData}
                            disabled={loading}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ====== 資訊面板 (固定顯示) ====== */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">分析區間</label>
                            <div className="flex items-center gap-1.5">
                                {[42, 84, 180, 365].map(range => {
                                    const isLocked = !isBound && range !== 42;
                                    const isActive = analysisRange === range;

                                    return (
                                        <button
                                            key={range}
                                            disabled={isLocked || loading}
                                            onClick={() => setAnalysisRange(range)}
                                            className={`
                                                relative px-3 py-1.5 rounded-lg text-xs font-black transition-all group
                                                ${isActive
                                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'}
                                                ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                                            `}
                                        >
                                            <span className="flex items-center gap-1">
                                                {range}D
                                                {isLocked && <Lock className="w-2.5 h-2.5" />}
                                            </span>

                                            {isLocked && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                    僅限認證會員
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-800" />
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">目前 FTP</label>
                            <span className="text-lg font-black text-blue-400">{currentFTP > 0 ? `${currentFTP}W` : '未設定'}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-800" />
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">體重</label>
                            <span className="text-lg font-black text-slate-300">{athleteWeight > 0 ? `${athleteWeight}kg` : '未設定'}</span>
                        </div>
                    </div>
                </div>

                {/* ====== 摘要統計列 ====== */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-white">{summaryStats.totalActivities}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">總騎乘數</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-emerald-400">{summaryStats.activitiesWithStreams}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">已分析活動</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-blue-400">{summaryStats.totalDistance.toLocaleString()}<span className="text-sm text-slate-500 ml-0.5">km</span></div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">總距離</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-orange-400">{summaryStats.totalElevation.toLocaleString()}<span className="text-sm text-slate-500 ml-0.5">m</span></div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">總爬升</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-purple-400">{formatTotalTime(summaryStats.totalTime)}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">總騎乘時間</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                        <div className="text-xl font-black text-yellow-400">{summaryStats.avgPower}<span className="text-sm text-slate-500 ml-0.5">W</span></div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">平均功率</div>
                    </div>
                </div>

                {/* ====== Loading 狀態 ====== */}
                {loading && (
                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center overflow-hidden relative">
                        {/* 背景裝飾光暈 */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

                        <div className="relative z-10">
                            <div className="relative w-16 h-16 mx-auto mb-6">
                                <Loader2 className="w-16 h-16 animate-spin text-blue-500/20 absolute inset-0" strokeWidth={1} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-black text-blue-400">
                                        {Math.round(displayProgress)}%
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm font-bold text-white mb-2 uppercase tracking-widest italic">正在分析數據</p>
                            <p className="text-[10px] text-slate-500 mb-6 uppercase tracking-[0.2em]">POWER ANALYSIS ENGINE INITIALIZING</p>

                            {streamLoadProgress.total > 0 && (
                                <div className="max-w-xs mx-auto">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">
                                        <span className="flex items-center gap-1.5 text-blue-400/80">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                            STREAMS PROCESSING
                                        </span>
                                        <span>{streamLoadProgress.loaded} / {streamLoadProgress.total}</span>
                                    </div>
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                            style={{ width: `${displayProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-2 italic font-medium">批量執行功率矩陣運算中...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ====== Error 狀態 ====== */}
                {error && (
                    <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-6 text-center">
                        <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-400 font-bold">{error}</p>
                        <button
                            onClick={loadAnalysisData}
                            className="mt-3 text-xs font-bold text-red-400 underline hover:text-red-300"
                        >
                            重試
                        </button>
                    </div>
                )}

                {/* ====== 主要內容 ====== */}
                {!loading && !error && (
                    <>
                        {/* Tab 切換 */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.key
                                        ? 'bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/5'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                                        }`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Tab 內容 */}
                        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 sm:p-6">
                            {/* Tab 標題 */}
                            <div className="mb-6">
                                <h2 className="text-lg font-black text-white flex items-center gap-2">
                                    {TABS.find(t => t.key === activeTab)?.icon}
                                    {TABS.find(t => t.key === activeTab)?.label}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {TABS.find(t => t.key === activeTab)?.description}
                                </p>
                            </div>

                            {/* MMP / CP 模型 */}
                            {activeTab === 'mmp' && (
                                mmpViewData.current.length > 0 || mmpViewData.reference.length > 0 ? (
                                    <MMPChart
                                        powerArrays={mmpViewData.current}
                                        referencePowerArrays={mmpViewData.reference}
                                        ftp={currentFTP}
                                        weight={athleteWeight}
                                        rangeLabel={`${analysisRange}D`}
                                    />
                                ) : (
                                    <EmptyState
                                        icon={<TrendingUp className="w-8 h-8" />}
                                        title="尚無功率數據"
                                        description="需要至少一個已同步 Streams 的活動才能生成 MMP 曲線。請先到 Power Dashboard 同步活動數據。"
                                    />
                                )
                            )}

                            {/* FTP 趨勢 */}
                            {activeTab === 'ftp' && (
                                <div className="relative">
                                    <FTPTrendChart
                                        data={ftpHistory}
                                        activities={activities}
                                        currentFtp={currentFTP}
                                    />
                                    {!isBound && (
                                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl border border-dashed border-slate-700/50">
                                            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 shadow-2xl text-center max-w-xs animate-in fade-in zoom-in duration-300">
                                                <Lock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                                                <p className="text-sm font-bold text-white uppercase tracking-wider mb-1">長期趨勢未解鎖</p>
                                                <p className="text-[10px] text-slate-400 leading-relaxed capitalize">綁定 TCU 會員即可查看完整的 FTP 進階趨勢追蹤與分析</p>
                                                <Link to="/" className="inline-block mt-3 text-[10px] font-black text-blue-400 hover:text-blue-300 underline underline-offset-4">立即綁定會員</Link>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 訓練量 */}
                            {activeTab === 'volume' && (
                                <TrainingVolumeChart dailyTSSData={dailyTSSData} />
                            )}

                            {/* 體能管理 (PMC) */}
                            {activeTab === 'pmc' && (
                                activities.length > 0 ? (
                                    <div className="relative">
                                        <PMCChart activities={activities} ftp={currentFTP} />
                                        {!isBound && (
                                            <div className="absolute top-2 right-2">
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold shadow-lg">
                                                    <Lock className="w-3 h-3" />
                                                    <span>綁定會員解鎖 90 天/1 年完整趨勢</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={<Activity className="w-8 h-8" />}
                                        title="尚無活動數據"
                                        description="需要活動記錄才能生成體能管理圖表。"
                                    />
                                )
                            )}
                        </div>

                        {/* 頁尾參考資訊 */}
                        <div className="text-center py-4 space-y-1">
                            <p className="text-[10px] text-slate-600">
                                功率模型基於 Morton's 3-Parameter Critical Power Model · 功率分級標準參考 Coggan Power Profile
                            </p>
                            <p className="text-[10px] text-slate-700">
                                參考專案：
                                <a href="https://github.com/velozs/cycling-analytics" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 mx-1 underline">Velozs Cycling Analytics</a>
                                ·
                                <a href="https://github.com/GoldenCheetah/GoldenCheetah" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 mx-1 underline">GoldenCheetah</a>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// 空狀態元件
const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="py-16 text-center">
        <div className="text-slate-600 mx-auto mb-3 w-fit">{icon}</div>
        <p className="text-sm font-bold text-slate-400 mb-1">{title}</p>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{description}</p>
        <Link
            to="/power"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-blue-400 hover:text-blue-300"
        >
            <ArrowLeft className="w-3.5 h-3.5" />
            回到 Power Dashboard
        </Link>
    </div>
);

export default PowerAnalysisPage;
