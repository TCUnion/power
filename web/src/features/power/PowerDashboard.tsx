import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle, User, RefreshCw, CheckCircle, Activity, ChevronDown, ChevronUp, Zap, Heart, Target, TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePowerAnalysis } from '../../hooks/usePowerAnalysis';
import type {
    StravaActivity,
    ActivityPowerAnalysis,
    StravaZoneSummary,
} from '../../types';

import { PMCChart } from '../../components/charts/PMCChart';
import { DailyTrainingChart } from '../../components/charts/DailyTrainingChart';
import { TrainingLoadCard } from './components/TrainingLoadCard';
import { PowerZoneChart } from './components/PowerZoneChart';
import { HRZoneChart } from './components/HRZoneChart';
import { StravaZoneChart } from './components/StravaZoneChart';
import { ActivityCharts } from './components/ActivityCharts';
import { formatDuration } from '../../utils/formatters';

const PowerDashboard: React.FC = () => {
    const { athlete } = useAuth();
    const [recentActivities, setRecentActivities] = useState<StravaActivity[]>([]);
    const [chartActivities, setChartActivities] = useState<StravaActivity[]>([]); // For charts (non-paginated)
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [currentFTP, setCurrentFTP] = useState(0);
    const [currentMaxHR] = useState(190);

    // 分頁狀態
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // 報表相關狀態
    const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
    const [activityAnalysis, setActivityAnalysis] = useState<ActivityPowerAnalysis | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    // 已存在的 Streams ID 列表
    const [availableStreams, setAvailableStreams] = useState<Set<number>>(new Set());
    const [globalSyncStats, setGlobalSyncStats] = useState<{ syncedCount: number; pendingIds: number[] }>({
        syncedCount: 0,
        pendingIds: []
    });

    const { getActivityStreams, analyzeActivityPower, checkStreamsAvailability } = usePowerAnalysis();

    // 1. 取得最近活動列表 & 選手基本數據
    useEffect(() => {
        if (!athlete?.id) return;

        const fetchData = async () => {
            setLoadingActivities(true);
            try {
                // 計算分頁範圍
                const from = (currentPage - 1) * itemsPerPage;
                const to = from + itemsPerPage - 1;

                const { data: activities, error, count } = await supabase
                    .from('strava_activities')
                    .select('id, athlete_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, sport_type, start_date, average_watts, max_watts, average_heartrate, max_heartrate', { count: 'exact' })
                    .eq('athlete_id', athlete.id)
                    .order('start_date', { ascending: false })
                    .range(from, to);

                if (count !== null) setTotalCount(count);

                if (error) throw error;
                const activityList = activities || [];
                setRecentActivities(activityList);

                // 檢查哪些活動已有 Streams
                if (activityList.length > 0) {
                    const ids = activityList.map(a => a.id);
                    const availableIds = await checkStreamsAvailability(ids);
                    setAvailableStreams(new Set(availableIds));

                    // 嘗試從最近的 Streams 中找出 FTP (若有)
                    try {
                        const { data: latestStream, error: streamErr } = await supabase
                            .from('strava_streams')
                            .select('ftp')
                            .in('activity_id', availableIds)
                            .gt('ftp', 0)
                            .order('activity_id', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (streamErr) throw streamErr;
                        if (latestStream) {
                            setCurrentFTP(latestStream.ftp || 0);
                        }
                    } catch (sErr) {
                        console.warn('[PowerDashboard] 取得最近數據流 FTP 失敗:', sErr);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch athlete activities:', err);
            } finally {
                setLoadingActivities(false);
            }
        };

        fetchData();
    }, [athlete?.id, checkStreamsAvailability, currentPage, itemsPerPage]);

    // 1.5 取得圖表用數據 (過去 180 天，不分頁)
    useEffect(() => {
        if (!athlete?.id) return;
        const fetchChartData = async () => {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setHours(0, 0, 0, 0); // 固定時間部分，避免毫秒漂移引發重複更新
            sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

            const { data, error: chartError } = await supabase
                .from('strava_activities')
                .select('id, athlete_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, sport_type, start_date, average_watts, max_watts, average_heartrate, max_heartrate')
                .eq('athlete_id', athlete.id)
                .gte('start_date', sixMonthsAgo.toISOString())
                .order('start_date', { ascending: true });

            if (chartError) {
                console.warn('[PowerDashboard] 取得圖表數據失敗:', chartError);
            }

            if (data) {
                setChartActivities(data as StravaActivity[]);
            }
        };
        fetchChartData();
    }, [athlete?.id]);

    // 1.6 取得全局同步統計 (用於同步按鈕顯示與全量發送)
    useEffect(() => {
        if (!athlete?.id) return;
        const fetchGlobalStats = async () => {
            try {
                // 1. 取得該選手最新的 42 筆活動 ID
                const { data: latestActivities } = await supabase
                    .from('strava_activities')
                    .select('id')
                    .eq('athlete_id', athlete.id)
                    .order('start_date', { ascending: false })
                    .limit(42);

                if (!latestActivities || latestActivities.length === 0) {
                    setGlobalSyncStats({ syncedCount: 0, pendingIds: [] });
                    return;
                }

                const allIds = latestActivities.map(a => String(a.id));

                // 2. 檢查哪些已存在於 strava_streams
                const { data: streams, error: streamError } = await supabase
                    .from('strava_streams')
                    .select('activity_id')
                    .in('activity_id', allIds);

                if (streamError) throw streamError;

                const syncedSet = new Set(streams?.map(s => String(s.activity_id)) || []);
                const syncedCount = syncedSet.size;
                const pendingIds = allIds.filter(id => !syncedSet.has(id)).map(id => Number(id));

                setGlobalSyncStats({
                    syncedCount: syncedCount,
                    pendingIds: pendingIds
                });
            } catch (err) {
                console.error('獲取全局同步統計失敗:', err);
                setGlobalSyncStats({ syncedCount: 0, pendingIds: [] });
            }
        };
        fetchGlobalStats();
    }, [athlete?.id, availableStreams]);

    // [New] 監聽選定活動，當數據流變為可用時自動加載分析 (反應式設計)
    useEffect(() => {
        if (selectedActivity && availableStreams.has(selectedActivity.id)) {
            // 如果還沒載入分析，或者分析的 ID 不對，則加載
            if (!activityAnalysis || activityAnalysis.activityId !== selectedActivity.id) {
                const load = async () => {
                    setLoadingAnalysis(true);
                    try {
                        const streams = await getActivityStreams(selectedActivity.id);
                        if (streams) {
                            const analysisFtp = streams.ftp || currentFTP;
                            const analysisMaxHR = streams.max_heartrate || currentMaxHR;
                            const analysis = analyzeActivityPower(selectedActivity, streams, analysisFtp, analysisMaxHR);
                            setActivityAnalysis(analysis);
                        }
                    } catch (err) {
                        console.error('自動加載分析失敗:', err);
                    } finally {
                        setLoadingAnalysis(false);
                    }
                };
                load();
            }
        }
    }, [selectedActivity, availableStreams, getActivityStreams, analyzeActivityPower, currentFTP, currentMaxHR, activityAnalysis]);

    // 計算週 TSS（簡化版）
    const weeklyTSS = React.useMemo(() => {
        if (!recentActivities.length) return 0;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        return recentActivities
            .filter(a => new Date(a.start_date) >= oneWeekAgo && (a.sport_type === 'Ride' || a.sport_type === 'VirtualRide') && a.average_watts)
            .reduce((sum, a) => {
                // 簡化 TSS 估算：(時間 * IF^2 * 100) / 3600
                const estimatedIF = currentFTP > 0 ? (a.average_watts || 0) / currentFTP : 0;
                const estimatedTSS = (a.moving_time * Math.pow(estimatedIF, 2) * 100) / 3600;
                return sum + estimatedTSS;
            }, 0);
    }, [recentActivities, currentFTP]);

    // 同步統計資料
    const syncStats = React.useMemo(() => {
        const synced = globalSyncStats.syncedCount;
        const pending = globalSyncStats.pendingIds.length;
        const pendingIds = globalSyncStats.pendingIds;

        // 預估時間（秒）
        const estimatedSeconds = pending * 3;
        const formatEstimate = (s: number) => {
            if (s < 60) return `${s} 秒`;
            const m = Math.floor(s / 60);
            const rs = s % 60;
            return rs > 0 ? `${m} 分 ${rs} 秒` : `${m} 分鐘`;
        };

        return { synced, pending, pendingIds, estimatedTimeStr: formatEstimate(estimatedSeconds) };
    }, [globalSyncStats]);

    // 分析選定活動
    const handleActivitySelect = async (activity: StravaActivity) => {
        if (selectedActivity?.id === activity.id) {
            setSelectedActivity(null);
            setActivityAnalysis(null);
            return;
        }

        setSelectedActivity(activity);
        setLoadingAnalysis(true);
        try {
            const streams = await getActivityStreams(activity.id);
            if (streams) {
                // 使用 Streams 裡的 FTP 或是目前的 FTP
                const analysisFtp = streams.ftp || currentFTP;
                const analysisMaxHR = streams.max_heartrate || currentMaxHR;

                const analysis = analyzeActivityPower(activity, streams, analysisFtp, analysisMaxHR);
                setActivityAnalysis(analysis);
            } else {
                setActivityAnalysis(null);
            }
        } catch (err) {
            console.error('分析活動失敗:', err);
            setActivityAnalysis(null);
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // 同步狀態管理: { [activityId]: 'idle' | 'syncing' | 'success' | 'error' }
    const [syncStatus, setSyncStatus] = useState<Record<number, 'idle' | 'syncing' | 'success' | 'error'>>({});
    const [lastSyncTime, setLastSyncTime] = useState<Record<number, number>>({});
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncAllMessage, setSyncAllMessage] = useState<string | null>(null);

    // 輔助函數：帶重試機制的 Fetch
    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, options);
                if (res.ok) return res;
            } catch (err) {
                if (i === retries - 1) throw err;
            }
            // 等待一下再重試
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('超過重試次數');
    };

    // 觸發全量同步 (呼叫 n8n 工作流)
    const handleSyncAllActivities = async () => {
        if (isSyncingAll) return;

        if (syncStats.pending === 0) {
            alert('所有活動皆已同步完成！');
            return;
        }

        const confirmMsg = `確定要同步 ${syncStats.pending} 個活動嗎？\n預估時間：${syncStats.estimatedTimeStr}\n優化模式：啟用併發處理與自動重試。`;
        if (!confirm(confirmMsg)) return;

        setIsSyncingAll(true);
        const total = syncStats.pendingIds.length;
        const chunkSize = 20;
        const chunks = [];
        for (let i = 0; i < total; i += chunkSize) {
            chunks.push(syncStats.pendingIds.slice(i, i + chunkSize));
        }

        try {
            let processedCount = 0;
            const CONCURRENCY = 2; // 一次跑 2 個請求

            for (let i = 0; i < chunks.length; i += CONCURRENCY) {
                const batchPromises = chunks.slice(i, i + CONCURRENCY).map(async (currentChunk) => {
                    await fetchWithRetry('https://service.criterium.tw/webhook/strava-sync-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            athlete_id: athlete?.id,
                            activity_ids: currentChunk,
                            is_chunk: true,
                            requested_at: new Date().toISOString()
                        })
                    });

                    // 成功後更新進度與狀態
                    processedCount += currentChunk.length;
                    const percent = Math.round((processedCount / total) * 100);
                    setSyncAllMessage(`正在同步中: ${percent}% (${processedCount}/${total})`);

                    setAvailableStreams(prev => {
                        const next = new Set(prev);
                        currentChunk.forEach(id => next.add(id));
                        return next;
                    });
                });

                await Promise.all(batchPromises);
            }

            setSyncAllMessage('🎉 全量同步任務圓滿達成！');
            setTimeout(() => {
                setSyncAllMessage(null);
                setIsSyncingAll(false);
            }, 3000);

        } catch (error) {
            console.error('優化同步失敗:', error);
            setSyncAllMessage('同步中斷，已保存現有進度。請確認網路後重試。');
            setTimeout(() => {
                setIsSyncingAll(false);
            }, 5000);
        }
    };

    // 觸發同步 (手動呼叫 Webhook)
    const handleSyncActivity = async (e: React.MouseEvent, activity: StravaActivity) => {
        e.stopPropagation();

        const now = Date.now();
        const lastTime = lastSyncTime[activity.id] || 0;
        if (syncStatus[activity.id] === 'syncing' || (now - lastTime < 5000)) return;

        setSyncStatus(prev => ({ ...prev, [activity.id]: 'syncing' }));
        setLastSyncTime(prev => ({ ...prev, [activity.id]: now }));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // 模擬 Strava Webhook Payload
            const payload = {
                aspect_type: "create",
                event_time: Math.floor(Date.now() / 1000),
                object_id: Number(activity.id),
                activity_id: Number(activity.id),
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
                // 開始輪詢檢查資料是否已入庫
                let retries = 0;
                const maxRetries = 20;

                const checkData = async (): Promise<boolean> => {
                    const { data: streamData } = await supabase
                        .from('strava_streams')
                        .select('activity_id')
                        .eq('activity_id', activity.id)
                        .maybeSingle();

                    if (streamData) {
                        // 資料已到，更新 UI
                        setSyncStatus(prev => ({ ...prev, [activity.id]: 'success' }));
                        setAvailableStreams(prev => new Set(prev).add(activity.id));

                        // 補上 FTP 設定
                        const ftpToSave = currentFTP || 0;
                        const maxHrToSave = currentMaxHR || 190;
                        await supabase.from('strava_streams')
                            .update({ ftp: ftpToSave, max_heartrate: maxHrToSave })
                            .eq('activity_id', activity.id);

                        setTimeout(() => {
                            setSyncStatus(prev => ({ ...prev, [activity.id]: 'idle' }));
                        }, 1000);
                        return true;
                    }
                    return false;
                };

                const poll = async () => {
                    if (retries >= maxRetries) {
                        setSyncStatus(prev => ({ ...prev, [activity.id]: 'error' }));
                        setTimeout(() => setSyncStatus(prev => ({ ...prev, [activity.id]: 'idle' })), 3000);
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
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            console.error('同步失敗:', error);
            setSyncStatus(prev => ({ ...prev, [activity.id]: 'error' }));
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [activity.id]: 'idle' })), 3000);
        }
    };

    // 更新活動特定的 FTP
    const handleUpdateFtp = async (newFtp: number) => {
        if (!selectedActivity) return;
        try {
            const { error } = await supabase
                .from('strava_streams')
                .update({ ftp: newFtp })
                .eq('activity_id', selectedActivity.id);

            if (error) throw error;

            // 更新全域狀態 (讓使用者感覺 FTP 已全域更新)
            setCurrentFTP(newFtp);

            // Re-calculate
            const streams = await getActivityStreams(selectedActivity.id);
            if (streams) {
                const analysis = analyzeActivityPower(selectedActivity, streams, newFtp, activityAnalysis?.max_heartrate || currentMaxHR);
                setActivityAnalysis(analysis);
            }
        } catch (error) {
            console.error('更新 FTP 失敗:', error);
        }
    };

    if (!athlete) return <div className="p-4 text-slate-400">請先登入 Strava</div>;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
                {/* 標題列 - 優化手機版佈局 */}
                <div className="p-4 sm:p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-3 mb-4">
                        {athlete.profile ? (
                            <img
                                src={athlete.profile}
                                alt={athlete.firstname}
                                className="w-12 h-12 rounded-full object-cover border-2 border-orange-500/50"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                                <span className="truncate">{athlete.firstname} {athlete.lastname}</span>
                                <Link
                                    to="/analysis"
                                    className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-gradient-to-r from-orange-500/20 to-yellow-500/20 text-orange-300 border border-orange-500/30 shrink-0 hover:from-orange-500/30 hover:to-yellow-500/30 transition-all flex items-center gap-1"
                                >
                                    <TrendingUp className="w-3 h-3" />
                                    進階分析
                                </Link>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                目前設定 FTP: <span className="text-white font-mono font-bold">{currentFTP > 0 ? `${currentFTP}W` : '未設定'}</span>
                                <span className="mx-1.5">·</span>
                                本週 TSS: <span className="text-white font-mono font-bold">{Math.round(weeklyTSS)}</span>
                            </p>
                        </div>
                    </div>

                    {/* 下方：同步進度 */}
                    <div className="flex items-center justify-between gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 font-medium">同步進度 (最新 42 筆)</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold text-emerald-400">已同步: {syncStats.synced}</span>
                                    <span className="text-slate-600">|</span>
                                    <span className={`text-xs font-bold ${syncStats.pending > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                                        待同步: {syncStats.pending}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <button
                                onClick={handleSyncAllActivities}
                                disabled={isSyncingAll || syncStats.pending === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${(isSyncingAll || syncStats.pending === 0)
                                        ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                                    }`}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">
                                    {isSyncingAll ? '同步中...' : syncStats.pending === 0 ? '已全部同步' : '同步全部'}
                                </span>
                                <span className="sm:hidden">
                                    {isSyncingAll ? '...' : syncStats.pending === 0 ? '✓' : '同步'}
                                </span>
                            </button>
                            {syncAllMessage && (
                                <span className="text-[10px] text-blue-400 animate-pulse font-medium max-w-[150px] truncate">
                                    {syncAllMessage}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 內容區域 */}
                <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                        {/* 上方：PMC 圖表 & 每日訓練圖表 */}
                        <div className="xl:col-span-12 space-y-6">
                            <PMCChart activities={chartActivities.length > 0 ? chartActivities : recentActivities} ftp={currentFTP} />
                            <DailyTrainingChart activities={chartActivities.length > 0 ? chartActivities : recentActivities} ftp={currentFTP} />
                        </div>

                        {/* 下方：最近活動紀錄 */}
                        <div className="xl:col-span-12">
                            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                最近活動紀錄
                            </h3>
                            <div className="space-y-2">
                                {loadingActivities ? (
                                    <div className="text-center py-8 text-slate-500">載入中...</div>
                                ) : recentActivities.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">尚無活動紀錄</div>
                                ) : (
                                    recentActivities.map(activity => {
                                        const isSynced = availableStreams.has(activity.id);
                                        const isSyncing = syncStatus[activity.id] === 'syncing';

                                        // 使用標準 TSS 公式
                                        const avgWatts = activity.average_watts || 0;
                                        const np = activity.weighted_average_watts || (avgWatts * 1.05);
                                        const intensity = currentFTP > 0 ? np / currentFTP : 0;
                                        const tss = currentFTP > 0 ? (activity.moving_time * np * intensity) / (currentFTP * 3600) * 100 : 0;

                                        return (
                                            <div
                                                key={activity.id}
                                                className={`bg-slate-800/40 rounded-lg border transition-all duration-200 overflow-hidden
                                                    ${selectedActivity?.id === activity.id
                                                        ? 'border-blue-500/50 bg-slate-800/80 shadow-lg shadow-blue-500/10'
                                                        : 'border-slate-700/30 hover:bg-slate-800/60 hover:border-slate-600'
                                                    }`}
                                            >
                                                {/* Header Row */}
                                                <div
                                                    className="p-3 sm:px-4 flex items-center justify-between cursor-pointer group"
                                                    onClick={() => handleActivitySelect(activity)}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className={`w-1 h-8 rounded-full flex-shrink-0 ${activity.sport_type === 'Ride' || activity.sport_type === 'VirtualRide'
                                                            ? 'bg-yellow-500'
                                                            : 'bg-slate-600'
                                                            }`} />

                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={`https://www.strava.com/activities/${activity.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className={`font-medium truncate transition-colors hover:underline ${selectedActivity?.id === activity.id ? 'text-blue-300' : 'text-slate-200 group-hover:text-white'
                                                                        }`}
                                                                >
                                                                    {activity.name}
                                                                </a>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">
                                                                    {activity.sport_type === 'VirtualRide' ? 'Virtual' : activity.sport_type}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                                {new Date(activity.start_date).toLocaleDateString()}
                                                                <span>•</span>
                                                                {formatDuration(activity.moving_time)}
                                                                <span>•</span>
                                                                {((activity.distance || 0) / 1000).toFixed(1)} km

                                                                {isSyncing ? (
                                                                    <span className="flex items-center gap-1 text-blue-400 ml-2">
                                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                                        同步中...
                                                                    </span>
                                                                ) : isSynced ? (
                                                                    <span className="flex items-center gap-1 text-emerald-400 ml-2" title="數據已同步">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => handleSyncActivity(e, activity)}
                                                                        className="flex items-center gap-1 text-slate-500 hover:text-blue-400 ml-2 transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-blue-500/30 hover:bg-blue-500/10"
                                                                        title="點擊同步詳細數據"
                                                                    >
                                                                        <RefreshCw className="w-3 h-3" />
                                                                        <span className="text-[10px]">同步</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                                        {(() => {
                                                            const isActiveAndAnalyzed = selectedActivity?.id === activity.id && activityAnalysis;
                                                            const displayTss = isActiveAndAnalyzed ? activityAnalysis.trainingLoad.tss : tss;
                                                            const displayNp = isActiveAndAnalyzed ? activityAnalysis.trainingLoad.np : np;
                                                            const displayIf = isActiveAndAnalyzed ? activityAnalysis.trainingLoad.if : intensity;
                                                            const displayAvg = isActiveAndAnalyzed ? activityAnalysis.trainingLoad.avgPower : avgWatts;

                                                            if (!isSynced || avgWatts <= 0) return null;
                                                            return (
                                                                <>
                                                                    <div className="hidden sm:flex flex-col items-end">
                                                                        <span className="text-xs font-mono text-pink-400 font-bold">{Math.round(displayTss)}</span>
                                                                        <span className="text-[10px] text-slate-600">TSS</span>
                                                                    </div>
                                                                    <div className="hidden sm:flex flex-col items-end">
                                                                        <span className="text-xs font-mono text-orange-400 font-bold">{Math.round(displayNp)}W</span>
                                                                        <span className="text-[10px] text-slate-600">NP</span>
                                                                    </div>
                                                                    <div className="hidden md:flex flex-col items-end">
                                                                        <span className="text-xs font-mono text-blue-400 font-bold">{displayIf.toFixed(2)}</span>
                                                                        <span className="text-[10px] text-slate-600">IF</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-xs font-mono text-yellow-500 font-bold">{Math.round(displayAvg)}W</span>
                                                                        <span className="text-[10px] text-slate-600">AVG</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}

                                                        {selectedActivity?.id === activity.id ? (
                                                            <ChevronUp className="w-4 h-4 text-blue-400" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-slate-600" />
                                                        )}
                                                    </div>
                                                </div>

                                                {selectedActivity?.id === activity.id && (
                                                    <div className="border-t border-slate-700/30 bg-slate-900/30">
                                                        {loadingAnalysis ? (
                                                            <div className="py-8 flex justify-center">
                                                                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                                                            </div>
                                                        ) : activityAnalysis ? (
                                                            <div className="p-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                                                {activityAnalysis.trainingLoad.np > 0 && (
                                                                    <div>
                                                                        <h5 className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">數據概覽</h5>
                                                                        <TrainingLoadCard
                                                                            load={activityAnalysis.trainingLoad}
                                                                            ftp={activityAnalysis.ftp}
                                                                            sportType={selectedActivity.sport_type}
                                                                            hasStravaZones={!!activityAnalysis.stravaZones}
                                                                            onUpdateFtp={handleUpdateFtp}
                                                                        />
                                                                    </div>
                                                                )}

                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                    {activityAnalysis.powerZones && (selectedActivity.sport_type === 'Ride' || selectedActivity.sport_type === 'VirtualRide') && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                                <Zap className="w-3 h-3" /> 功率區間
                                                                            </h5>
                                                                            <PowerZoneChart zones={activityAnalysis.powerZones} />
                                                                        </div>
                                                                    )}

                                                                    {activityAnalysis.hrZones && activityAnalysis.hrZones.length > 0 && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                                <Heart className="w-3 h-3" /> 心率區間
                                                                            </h5>
                                                                            <HRZoneChart zones={activityAnalysis.hrZones} />
                                                                        </div>
                                                                    )}

                                                                    {activityAnalysis.stravaZones && activityAnalysis.stravaZones.length > 0 && !activityAnalysis.hrZones && (
                                                                        <div>
                                                                            <h5 className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                                <Target className="w-3 h-3" /> Strava 原始分析
                                                                            </h5>
                                                                            <div className="space-y-4">
                                                                                {(() => {
                                                                                    const zones: StravaZoneSummary[] = Array.isArray(activityAnalysis.stravaZones)
                                                                                        ? activityAnalysis.stravaZones.map(z => ({
                                                                                            type: 'heartrate' as const,
                                                                                            distribution_buckets: [z] as any[]
                                                                                        }))
                                                                                        : (activityAnalysis.stravaZones ? [{
                                                                                            type: 'heartrate' as const,
                                                                                            distribution_buckets: activityAnalysis.stravaZones as any[]
                                                                                        }] : []);

                                                                                    return zones
                                                                                        .filter((z) => z.type === 'power' || z.type === 'heartrate')
                                                                                        .map((z, idx: number) => (
                                                                                            <StravaZoneChart key={idx} data={z.distribution_buckets || []} type={z.type} />
                                                                                        ));
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="pt-4 border-t border-slate-700/30">
                                                                    <h5 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">趨勢圖表</h5>
                                                                    <ActivityCharts data={activityAnalysis} />
                                                                </div>
                                                            </div>
                                                        ) : isSyncing ? (
                                                            <div className="py-12 text-center text-slate-500">
                                                                <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-blue-500 opacity-70" />
                                                                <p className="text-blue-400 font-medium animate-pulse">正在同步並偵測數據...</p>
                                                                <p className="text-xs mt-2 text-slate-600">偵測到數據入庫後將自動顯示圖表</p>
                                                            </div>
                                                        ) : (
                                                            <div className="py-8 text-center text-slate-500">
                                                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                                <p className="mb-2">此活動尚無詳細數據流</p>
                                                                {!isSynced && (
                                                                    <button
                                                                        onClick={(e) => handleSyncActivity(e, activity)}
                                                                        className="text-blue-400 hover:text-blue-300 underline text-sm"
                                                                    >
                                                                        立即同步數據
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* 分頁控制 */}
                            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-700/50">
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <span>顯示:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                    <span className="ml-2 hidden sm:inline">
                                        {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} / 共 {totalCount} 筆
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {/* Simple text for pagination if icons missing */}
                                        Prev
                                    </button>
                                    <span className="text-sm text-slate-400 font-mono">
                                        {currentPage} / {Math.ceil(totalCount / itemsPerPage) || 1}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1))}
                                        disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PowerDashboard;
