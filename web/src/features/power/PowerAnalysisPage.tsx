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
    Activity, Loader2, AlertCircle, RefreshCw
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
    const { athlete } = useAuth();
    const { getActivityStreams, calculateNPViaDB, calculateTSSViaDB } = usePowerAnalysis();

    // 頁面狀態
    const [activeTab, setActiveTab] = useState<TabKey>('mmp');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 數據狀態
    const [activities, setActivities] = useState<StravaActivity[]>([]);
    const [powerArrays, setPowerArrays] = useState<number[][]>([]);
    const [currentFTP, setCurrentFTP] = useState(0);
    const [athleteWeight, setAthleteWeight] = useState(0);
    const [streamLoadProgress, setStreamLoadProgress] = useState({ loaded: 0, total: 0 });

    // FTP 歷史數據
    const [ftpHistory, setFtpHistory] = useState<{ date: string; ftp: number; source: 'recorded' | 'estimated' }[]>([]);

    // 每日 TSS 數據
    const [dailyTSSData, setDailyTSSData] = useState<{ date: string; tss: number; activityCount: number }[]>([]);

    // 設定面板已移除，改為固定顯示
    const [analysisRange] = useState<number>(42);

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
            cutoffDate.setDate(cutoffDate.getDate() - analysisRange);

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
                .select('*')
                .eq('athlete_id', athlete.id)
                .gte('start_date', cutoffDate.toISOString())
                .in('sport_type', ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide'])
                .order('start_date', { ascending: false });

            if (actError) throw actError;
            const acts = activityData || [];
            setActivities(acts);

            if (acts.length === 0) {
                setLoading(false);
                return;
            }

            // 批量取得所有 Streams（分批處理避免超時）
            const allPowerArrays: number[][] = [];
            const ftpHist: typeof ftpHistory = [];
            const dailyTSS: Record<string, { tss: number; count: number }> = {};

            const batchSize = 20;
            const totalBatches = Math.ceil(acts.length / batchSize);
            setStreamLoadProgress({ loaded: 0, total: acts.length });

            for (let batch = 0; batch < totalBatches; batch++) {
                const batchActs = acts.slice(batch * batchSize, (batch + 1) * batchSize);
                const batchIds = batchActs.map(a => a.id);

                // 批量查詢 Streams
                const { data: streamsData } = await supabase
                    .from('strava_streams')
                    .select('activity_id, streams, ftp')
                    .in('activity_id', batchIds);

                if (streamsData) {
                    for (const stream of streamsData) {
                        // 提取功率數據
                        const wattsStream = stream.streams?.find((s: any) => s.type === 'watts');
                        if (wattsStream?.data && wattsStream.data.length > 0) {
                            allPowerArrays.push(wattsStream.data);

                            // 紀錄 FTP 歷史快照
                            if (stream.ftp && stream.ftp > 0) {
                                const act = batchActs.find(a => a.id === stream.activity_id);
                                if (act) {
                                    ftpHist.push({
                                        date: act.start_date,
                                        ftp: stream.ftp,
                                        source: 'recorded',
                                    });
                                }
                            }

                            // 計算每日 TSS
                            const act = batchActs.find(a => a.id === stream.activity_id);
                            if (act) {
                                const effectiveFtp = stream.ftp || ftp;
                                if (effectiveFtp > 0) {
                                    const np = await calculateNPViaDB(wattsStream.data);
                                    const duration = act.elapsed_time || act.moving_time;
                                    const tss = await calculateTSSViaDB(np, effectiveFtp, duration);

                                    const dateKey = new Date(act.start_date).toISOString().split('T')[0];
                                    if (!dailyTSS[dateKey]) {
                                        dailyTSS[dateKey] = { tss: 0, count: 0 };
                                    }
                                    dailyTSS[dateKey].tss += tss;
                                    dailyTSS[dateKey].count += 1;
                                }
                            }
                        }
                    }
                }

                setStreamLoadProgress({ loaded: Math.min((batch + 1) * batchSize, acts.length), total: acts.length });
            }

            setPowerArrays(allPowerArrays);
            setFtpHistory(ftpHist);
            setDailyTSSData(
                Object.entries(dailyTSS)
                    .map(([date, data]) => ({ date, tss: Math.round(data.tss), activityCount: data.count }))
                    .sort((a, b) => a.date.localeCompare(b.date))
            );
        } catch (err: any) {
            console.error('載入分析數據失敗:', err);
            setError(err.message || '載入數據時發生錯誤');
        } finally {
            setLoading(false);
        }
    }, [athlete?.id, analysisRange, getActivityStreams, calculateNPViaDB, calculateTSSViaDB]);

    useEffect(() => {
        loadAnalysisData();
    }, [loadAnalysisData]);

    // 統計摘要數據
    const summaryStats = useMemo(() => {
        const totalActivities = activities.length;
        const activitiesWithStreams = powerArrays.length;
        const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
        const totalElevation = activities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0);
        const totalTime = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
        const avgPower = activities.reduce((sum, a) => sum + (a.average_watts || 0), 0) / (totalActivities || 1);

        return {
            totalActivities,
            activitiesWithStreams,
            totalDistance: Math.round(totalDistance),
            totalElevation: Math.round(totalElevation),
            totalTime,
            avgPower: Math.round(avgPower),
        };
    }, [activities, powerArrays]);

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
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">分析區間</label>
                            <div className="text-lg font-black text-white flex items-center gap-2">
                                42天
                                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">固定</span>
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
                    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-300 mb-2">正在載入分析數據...</p>
                        {streamLoadProgress.total > 0 && (
                            <div className="max-w-xs mx-auto">
                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                    <span>Streams 載入進度</span>
                                    <span>{streamLoadProgress.loaded}/{streamLoadProgress.total}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                        style={{ width: `${(streamLoadProgress.loaded / streamLoadProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
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
                                powerArrays.length > 0 ? (
                                    <MMPChart
                                        powerArrays={powerArrays}
                                        ftp={currentFTP}
                                        weight={athleteWeight}
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
                                <FTPTrendChart
                                    data={ftpHistory}
                                    activities={filteredActivities}
                                    currentFtp={userFtp}
                                />
                            )}

                            {/* 訓練量 */}
                            {activeTab === 'volume' && (
                                <TrainingVolumeChart dailyTSSData={dailyTSSData} />
                            )}

                            {/* 體能管理 (PMC) */}
                            {activeTab === 'pmc' && (
                                activities.length > 0 ? (
                                    <PMCChart activities={activities} ftp={currentFTP} />
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
