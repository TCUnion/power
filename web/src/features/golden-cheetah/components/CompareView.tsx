/**
 * CompareView — 多活動比較頁面
 * 
 * 讓使用者選擇最多 5 筆活動進行並排比較，包含：
 * 1. 關鍵指標數據表格
 * 2. 疊加功率曲線圖（按時間或距離）
 * 3. 功率分佈直方圖
 */
import { useState, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import {
    GitCompareArrows,
    Plus,
    X,
    Clock,
    Route,
    Zap,
    Heart,
    Mountain,
    Gauge,
    TrendingUp,
} from 'lucide-react';
import type { StravaActivity, StravaStreams, StreamData } from '../../../types';

// ============================================
// 型別定義
// ============================================

interface CompareViewProps {
    /** 全部已載入的活動 */
    allActivities: StravaActivity[];
    /** 全部已載入的串流數據 */
    allStreamsData: Partial<StravaStreams>[];
    /** 騎手體重 (kg) */
    athleteWeight: number;
}

/** 比較用的活動摘要 */
interface CompareActivity {
    activity: StravaActivity;
    streams: StreamData[];
    color: string;
}

// ============================================
// 常數
// ============================================

/** 各活動的固定顏色分配 */
const COMPARE_COLORS = ['#eab308', '#3b82f6', '#ef4444', '#22c55e', '#a855f7'];

/** 最大可比較活動數 */
const MAX_COMPARE = 5;

/** 功率分佈的區間寬度 (W) */
const POWER_BIN_WIDTH = 25;

// ============================================
// 輔助函式
// ============================================

/** 格式化時間為 HH:MM:SS */
function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** 格式化距離為 km */
function formatDistance(meters: number): string {
    return `${(meters / 1000).toFixed(1)} km`;
}

/** 格式化速度 m/s → km/h */
function formatSpeed(mps: number | undefined): string {
    if (!mps) return '—';
    return `${(mps * 3.6).toFixed(1)}`;
}

/** 格式化日期 */
function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 從串流中提取特定類型的數據 */
function getStream(streams: StreamData[], type: string): number[] {
    return streams.find(s => s.type === type)?.data || [];
}

/** 計算功率分佈直方圖 */
function calculatePowerHistogram(powerData: number[], binWidth: number): { bin: number; count: number }[] {
    if (powerData.length === 0) return [];
    const maxPower = Math.max(...powerData);
    const binCount = Math.ceil(maxPower / binWidth) + 1;
    const bins = new Array(binCount).fill(0);

    for (const p of powerData) {
        if (p > 0) {
            const idx = Math.floor(p / binWidth);
            if (idx < binCount) bins[idx]++;
        }
    }

    // 轉為百分比
    const total = powerData.filter(p => p > 0).length || 1;
    return bins.map((count, i) => ({
        bin: i * binWidth,
        count: Math.round((count / total) * 1000) / 10, // 百分比（一位小數）
    })).filter(b => b.bin <= maxPower + binWidth);
}

// ============================================
// 元件
// ============================================

export default function CompareView({
    allActivities,
    allStreamsData,
    athleteWeight,
}: CompareViewProps) {
    // 已選取的活動 ID
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    // 下拉選單開關
    const [showSelector, setShowSelector] = useState(false);
    // X 軸模式
    const [xAxisMode, setXAxisMode] = useState<'time' | 'distance'>('time');

    // 可選活動（有 stream 數據的活動）
    const availableActivities = useMemo(() => {
        return allActivities.filter(a => {
            const row = allStreamsData.find(s => s.activity_id === a.id);
            if (!row || !row.streams) return false;
            const streams = row.streams as StreamData[];
            const hasWatts = streams.some(s => s.type === 'watts' && s.data.length > 0);
            return hasWatts;
        });
    }, [allActivities, allStreamsData]);

    // 組合已選的比較活動
    const compareActivities: CompareActivity[] = useMemo(() => {
        return selectedIds.map((id, idx) => {
            const activity = allActivities.find(a => a.id === id)!;
            const row = allStreamsData.find(s => s.activity_id === id);
            const streams = (row?.streams as StreamData[]) || [];
            return {
                activity,
                streams,
                color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
            };
        }).filter(ca => ca.activity);
    }, [selectedIds, allActivities, allStreamsData]);

    // 新增活動到比較列表
    const addActivity = useCallback((activityId: number) => {
        setSelectedIds(prev => {
            if (prev.includes(activityId) || prev.length >= MAX_COMPARE) return prev;
            return [...prev, activityId];
        });
        setShowSelector(false);
    }, []);

    // 移除活動
    const removeActivity = useCallback((activityId: number) => {
        setSelectedIds(prev => prev.filter(id => id !== activityId));
    }, []);

    // ============================================
    // 疊加功率曲線數據
    // ============================================
    const overlayChartData = useMemo(() => {
        if (compareActivities.length === 0) return [];

        // 找出最長的數據集（取最短 10000 秒避免過多數據）
        const maxLen = Math.min(
            Math.max(...compareActivities.map(ca => getStream(ca.streams, 'watts').length)),
            10000
        );

        if (maxLen === 0) return [];

        // 降採樣步長
        const step = maxLen > 3000 ? Math.ceil(maxLen / 600) : 1;
        const data: Record<string, number | string>[] = [];

        for (let i = 0; i < maxLen; i += step) {
            const point: Record<string, number | string> = {};

            if (xAxisMode === 'time') {
                point.x = Math.round(i / 60 * 10) / 10; // 分鐘
            }

            compareActivities.forEach((ca, idx) => {
                const watts = getStream(ca.streams, 'watts');
                const distance = getStream(ca.streams, 'distance');

                if (xAxisMode === 'distance' && distance[i] !== undefined) {
                    // 使用第一個活動的距離作為 X 軸
                    if (idx === 0) {
                        point.x = Math.round(distance[i] / 100) / 10; // km
                    }
                }

                // 平滑功率值（30 秒滾動平均）
                if (i < watts.length) {
                    const windowSize = Math.min(30, step * 5);
                    const start = Math.max(0, i - Math.floor(windowSize / 2));
                    const end = Math.min(watts.length, i + Math.ceil(windowSize / 2));
                    let sum = 0;
                    let count = 0;
                    for (let j = start; j < end; j++) {
                        sum += watts[j];
                        count++;
                    }
                    point[`power_${idx}`] = count > 0 ? Math.round(sum / count) : 0;
                }
            });

            if (point.x !== undefined) {
                data.push(point);
            }
        }

        return data;
    }, [compareActivities, xAxisMode]);

    // ============================================
    // 功率分佈數據
    // ============================================
    const histogramData = useMemo(() => {
        if (compareActivities.length === 0) return [];

        // 計算各活動的直方圖
        const histograms = compareActivities.map(ca => {
            const watts = getStream(ca.streams, 'watts');
            return calculatePowerHistogram(watts, POWER_BIN_WIDTH);
        });

        // 合併到統一的 bin 軸
        const maxBin = Math.max(...histograms.map(h => Math.max(...h.map(b => b.bin), 0)));
        const allBins: Record<string, number | string>[] = [];

        for (let bin = 0; bin <= maxBin; bin += POWER_BIN_WIDTH) {
            const point: Record<string, number | string> = { bin: `${bin}` };
            compareActivities.forEach((_, idx) => {
                const hist = histograms[idx];
                const entry = hist.find(h => h.bin === bin);
                point[`pct_${idx}`] = entry ? entry.count : 0;
            });
            allBins.push(point);
        }

        return allBins;
    }, [compareActivities]);

    // ============================================
    // 空白狀態
    // ============================================
    if (selectedIds.length === 0) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <GitCompareArrows className="w-4 h-4 text-cyan-400" />
                        活動比較
                    </h2>
                </div>
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                    <div className="bg-slate-800 p-8 rounded-2xl text-center border border-slate-700 max-w-md">
                        <GitCompareArrows className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">開始比較活動</h3>
                        <p className="text-sm mb-6">選擇最多 {MAX_COMPARE} 筆活動進行並排比較</p>
                        <div className="relative">
                            <button
                                onClick={() => setShowSelector(!showSelector)}
                                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 mx-auto"
                            >
                                <Plus className="w-4 h-4" />
                                選擇活動
                            </button>
                            {showSelector && (
                                <ActivityDropdown
                                    activities={availableActivities}
                                    selectedIds={selectedIds}
                                    onSelect={addActivity}
                                    onClose={() => setShowSelector(false)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // 主渲染
    // ============================================
    return (
        <div className="space-y-4">
            {/* 標題列 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <GitCompareArrows className="w-4 h-4 text-cyan-400" />
                    活動比較 ({compareActivities.length}/{MAX_COMPARE})
                </h2>
                <div className="flex items-center gap-2">
                    {selectedIds.length < MAX_COMPARE && (
                        <div className="relative">
                            <button
                                onClick={() => setShowSelector(!showSelector)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                新增活動
                            </button>
                            {showSelector && (
                                <ActivityDropdown
                                    activities={availableActivities}
                                    selectedIds={selectedIds}
                                    onSelect={addActivity}
                                    onClose={() => setShowSelector(false)}
                                />
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setSelectedIds([])}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                    >
                        清空
                    </button>
                </div>
            </div>

            {/* 已選活動標籤 */}
            <div className="flex flex-wrap gap-2">
                {compareActivities.map((ca) => (
                    <div
                        key={ca.activity.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{
                            borderColor: ca.color + '40',
                            backgroundColor: ca.color + '10',
                            color: ca.color,
                        }}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: ca.color }}
                        />
                        <span className="truncate max-w-[180px]">
                            {formatDate(ca.activity.start_date)} {ca.activity.name}
                        </span>
                        <button
                            onClick={() => removeActivity(ca.activity.id)}
                            className="ml-1 hover:opacity-70 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            {/* 數據表格 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left p-3 text-slate-500 font-bold uppercase tracking-wider w-[140px]">指標</th>
                            {compareActivities.map((ca) => (
                                <th key={ca.activity.id} className="p-3 text-center font-bold" style={{ color: ca.color }}>
                                    <div className="truncate max-w-[150px] mx-auto">{ca.activity.name}</div>
                                    <div className="text-[10px] opacity-60 font-normal">{formatDate(ca.activity.start_date)}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        <MetricRow
                            icon={<Route className="w-3 h-3" />}
                            label="距離"
                            values={compareActivities.map(ca => formatDistance(ca.activity.distance))}
                            colors={compareActivities.map(ca => ca.color)}
                        />
                        <MetricRow
                            icon={<Clock className="w-3 h-3" />}
                            label="移動時間"
                            values={compareActivities.map(ca => formatDuration(ca.activity.moving_time))}
                            colors={compareActivities.map(ca => ca.color)}
                        />
                        <MetricRow
                            icon={<Gauge className="w-3 h-3" />}
                            label="平均速度"
                            values={compareActivities.map(ca => formatSpeed(ca.activity.average_speed))}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="km/h"
                        />
                        <MetricRow
                            icon={<Zap className="w-3 h-3" />}
                            label="平均功率"
                            values={compareActivities.map(ca => ca.activity.average_watts?.toString() || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="W"
                            highlight
                        />
                        <MetricRow
                            icon={<Zap className="w-3 h-3" />}
                            label="NP"
                            values={compareActivities.map(ca => ca.activity.weighted_average_watts?.toString() || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="W"
                        />
                        <MetricRow
                            icon={<Zap className="w-3 h-3" />}
                            label="最大功率"
                            values={compareActivities.map(ca => ca.activity.max_watts?.toString() || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="W"
                        />
                        <MetricRow
                            icon={<TrendingUp className="w-3 h-3" />}
                            label="W/kg"
                            values={compareActivities.map(ca =>
                                ca.activity.average_watts
                                    ? (ca.activity.average_watts / athleteWeight).toFixed(2)
                                    : '—'
                            )}
                            colors={compareActivities.map(ca => ca.color)}
                        />
                        <MetricRow
                            icon={<Heart className="w-3 h-3" />}
                            label="平均心率"
                            values={compareActivities.map(ca => ca.activity.average_heartrate?.toFixed(0) || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="bpm"
                        />
                        <MetricRow
                            icon={<Heart className="w-3 h-3" />}
                            label="最高心率"
                            values={compareActivities.map(ca => ca.activity.max_heartrate?.toFixed(0) || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="bpm"
                        />
                        <MetricRow
                            icon={<Mountain className="w-3 h-3" />}
                            label="爬升"
                            values={compareActivities.map(ca => `${ca.activity.total_elevation_gain.toFixed(0)}`)}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="m"
                        />
                        <MetricRow
                            icon={<Zap className="w-3 h-3" />}
                            label="功"
                            values={compareActivities.map(ca => ca.activity.kilojoules?.toFixed(0) || '—')}
                            colors={compareActivities.map(ca => ca.color)}
                            unit="kJ"
                        />
                    </tbody>
                </table>
            </div>

            {/* 疊加功率曲線圖 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        功率曲線對比（30 秒平滑）
                    </h3>
                    <div className="flex bg-slate-900/50 rounded-lg p-0.5">
                        <button
                            onClick={() => setXAxisMode('time')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${xAxisMode === 'time'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Clock className="w-3 h-3 inline mr-1" />
                            時間
                        </button>
                        <button
                            onClick={() => setXAxisMode('distance')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${xAxisMode === 'distance'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Route className="w-3 h-3 inline mr-1" />
                            距離
                        </button>
                    </div>
                </div>
                <div className="h-[300px] md:h-[380px]">
                    {overlayChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={overlayChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis
                                    dataKey="x"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    label={{
                                        value: xAxisMode === 'time' ? '時間 (min)' : '距離 (km)',
                                        position: 'insideBottomRight',
                                        offset: -5,
                                        fontSize: 10,
                                        fill: '#64748b',
                                    }}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: '功率 (W)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#334155',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                    }}
                                    formatter={(value: number, name: string) => {
                                        const idx = parseInt(name.split('_')[1]);
                                        const ca = compareActivities[idx];
                                        return [`${value} W`, ca ? ca.activity.name : name];
                                    }}
                                    labelFormatter={(label: number) => xAxisMode === 'time' ? `${label} min` : `${label} km`}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={28}
                                    formatter={(value: string) => {
                                        const idx = parseInt(value.split('_')[1]);
                                        const ca = compareActivities[idx];
                                        return ca ? ca.activity.name : value;
                                    }}
                                />
                                {compareActivities.map((ca, idx) => (
                                    <Line
                                        key={ca.activity.id}
                                        type="monotone"
                                        dataKey={`power_${idx}`}
                                        stroke={ca.color}
                                        strokeWidth={1.5}
                                        dot={false}
                                        activeDot={{ r: 3, fill: ca.color }}
                                        connectNulls={false}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                            請選擇活動以顯示功率比較圖
                        </div>
                    )}
                </div>
            </div>

            {/* 功率分佈直方圖 */}
            {histogramData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                        功率分佈對比 (每 {POWER_BIN_WIDTH}W)
                    </h3>
                    <div className="h-[250px] md:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogramData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis
                                    dataKey="bin"
                                    stroke="#64748b"
                                    tick={{ fontSize: 9 }}
                                    label={{ value: '功率 (W)', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#64748b' }}
                                    interval={1}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: '佔比 (%)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#334155',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                    }}
                                    formatter={(value: number, name: string) => {
                                        const idx = parseInt(name.split('_')[1]);
                                        const ca = compareActivities[idx];
                                        return [`${value}%`, ca ? ca.activity.name : name];
                                    }}
                                    labelFormatter={(label: string) => `${label}–${parseInt(label) + POWER_BIN_WIDTH} W`}
                                />
                                {compareActivities.map((ca, idx) => (
                                    <Bar
                                        key={ca.activity.id}
                                        dataKey={`pct_${idx}`}
                                        fill={ca.color}
                                        fillOpacity={0.7}
                                        radius={[2, 2, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// 子元件
// ============================================

/** 表格指標列 */
function MetricRow({
    icon,
    label,
    values,
    colors,
    unit,
    highlight,
}: {
    icon: React.ReactNode;
    label: string;
    values: string[];
    colors: string[];
    unit?: string;
    highlight?: boolean;
}) {
    // 找出最大數值以高亮顯示
    const numericValues = values.map(v => parseFloat(v) || 0);
    const maxVal = Math.max(...numericValues);
    const hasMax = numericValues.some(v => v > 0);

    return (
        <tr className={highlight ? 'bg-slate-900/30' : ''}>
            <td className="p-3 text-slate-400 flex items-center gap-1.5">
                {icon}
                <span className="font-bold">{label}</span>
            </td>
            {values.map((val, idx) => {
                const isMax = hasMax && parseFloat(val) === maxVal && val !== '—';
                return (
                    <td key={idx} className="p-3 text-center">
                        <span
                            className={`font-mono font-bold ${isMax ? 'ring-1 ring-offset-1 ring-offset-slate-800 rounded px-1.5 py-0.5' : ''}`}
                            style={{
                                color: colors[idx],
                                ...(isMax ? { ringColor: colors[idx] + '60' } : {}),
                            }}
                        >
                            {val}
                            {unit && val !== '—' && <span className="text-[10px] opacity-50 ml-0.5">{unit}</span>}
                        </span>
                    </td>
                );
            })}
        </tr>
    );
}

/** 活動選擇下拉選單 */
function ActivityDropdown({
    activities,
    selectedIds,
    onSelect,
    onClose,
}: {
    activities: StravaActivity[];
    selectedIds: number[];
    onSelect: (id: number) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        return activities
            .filter(a => !selectedIds.includes(a.id))
            .filter(a => {
                if (!query) return true;
                return a.name.toLowerCase().includes(query.toLowerCase());
            })
            .slice(0, 20);
    }, [activities, selectedIds, query]);

    return (
        <>
            {/* 點擊外部關閉 */}
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className="absolute top-full left-0 mt-1 z-50 w-[340px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                {/* 搜尋框 */}
                <div className="p-2 border-b border-slate-700">
                    <input
                        type="text"
                        placeholder="搜尋活動名稱..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        autoFocus
                    />
                </div>
                {/* 活動列表 */}
                <div className="max-h-[280px] overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                            沒有可選的活動
                        </div>
                    ) : (
                        filtered.map(a => (
                            <button
                                key={a.id}
                                onClick={() => onSelect(a.id)}
                                className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors flex items-center gap-3 border-b border-slate-800/50"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white truncate">{a.name}</div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span>{formatDate(a.start_date)}</span>
                                        <span>•</span>
                                        <span>{formatDistance(a.distance)}</span>
                                        <span>•</span>
                                        <span>{formatDuration(a.moving_time)}</span>
                                        {a.average_watts && (
                                            <>
                                                <span>•</span>
                                                <span className="text-yellow-500">{a.average_watts}W</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
