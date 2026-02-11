
import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Brush
} from 'recharts';
import type { SegmentEffort } from '../../../types';
import type { Segment } from '../hooks/useSegmentCompare';
import type { SyncStatus } from '../hooks/useActivitySync';
import { format } from 'date-fns';
import { ChevronsDown, ChevronsUp, Activity } from 'lucide-react';

import { RefreshCw, CheckCircle } from 'lucide-react';

interface CompareChartsProps {
    allEfforts: SegmentEffort[];
    selectedEfforts: SegmentEffort[];
    streams: Record<number, any>; // activityId -> streamData
    loading: boolean;
    segment?: Segment;
    onSync?: (activityId: number) => void;
    syncStatus?: Record<number, SyncStatus>;
    onToggleEffort?: (activityId: number) => void;
}


const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

export const CompareCharts: React.FC<CompareChartsProps> = ({
    allEfforts,
    selectedEfforts,
    streams,
    loading,
    segment,
    onSync,
    syncStatus = {},
    onToggleEffort
}) => {

    const [chartsExpanded, setChartsExpanded] = useState(true);
    const xAxisType = 'distance';
    const [visibleSeries, setVisibleSeries] = useState({
        power: false,
        heartrate: false,
        speed: false,
        cadence: false,
        elevation: true,
        time: true
    });

    // 1. Historical Trend Data
    const trendData = useMemo(() => {
        return allEfforts
            .map(effort => ({
                id: effort.activity_id,
                date: effort.start_date,
                timestamp: new Date(effort.start_date).getTime(),
                time: effort.elapsed_time,
                watts: effort.average_watts,
                dateStr: format(new Date(effort.start_date), 'yyyy-MM-dd'),
                activityName: effort.activity_name
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [allEfforts]);


    // 2. Detailed Comparison Data
    const comparisonData = useMemo(() => {
        if (selectedEfforts.length === 0) return [];

        // Find the "longest" effort (distance-wise) to normalize X-axis if needed, 
        // or just map everything. Recharts handles multiple lines well.
        // We need a unified X-axis for the tooltip to work nicely across multiple lines?
        // Actually, for multiple efforts with different sampling, it's tricky.
        // Best approach: Flatten all data into a single array? No, Recharts expects one array of objects with keys for each series.
        // But our series have different X resolutions and lengths.
        // Solution: Use the 'distance' stream of the first selected effort as the "master" X-axis? 
        // No, that's brittle.
        // Better: Find the effort with the most data points and map others to it?
        // OR: Just allow loosely coupled data if X-axis is "type: number".

        // Simplified approach for now:
        // Create a merged dataset. We iterate through the longest stream and interpolate/find nearest points from others?
        // Or simpler: Just prepare individual series and pass them to Recharts? 
        // Recharts <Line> can take `data` prop directly since v2.x! 
        // Let's try passing individual data to each Line.

        return selectedEfforts.map((effort, index) => {
            const stream = streams[effort.activity_id];
            if (!stream) return null;

            const dist = stream.distance || [];
            const time = stream.time || [];
            const watts = stream.watts || [];
            const hr = stream.heartrate || [];
            const alt = stream.altitude || [];
            const vel = stream.velocity_smooth || [];
            const cad = stream.cadence || [];

            // Normalize distance and time to start from 0 for the segment
            const startDist = dist.length > 0 ? dist[0] : 0;
            const startTime = time.length > 0 ? time[0] : 0;

            const normalizedDist = dist.map((d: number) => d - startDist);
            const normalizedTime = time.map((t: number) => t - startTime);

            const points = [];
            // Use distance or time as X
            const xStream = xAxisType === 'distance' ? normalizedDist : normalizedTime;

            for (let i = 0; i < xStream.length; i++) {
                // Downsample for performance if needed
                if (xStream.length > 2000 && i % 2 !== 0) continue;

                points.push({
                    x: xStream[i],
                    power: watts[i],
                    hr: hr[i],
                    alt: alt[i],
                    speed: vel[i] ? vel[i] * 3.6 : 0, // m/s to km/h
                    cad: cad[i],
                    time: normalizedTime[i]
                });
            }

            return {
                id: effort.activity_id,
                name: format(new Date(effort.start_date), 'yyyy-MM-dd'),
                color: COLORS[index % COLORS.length],
                data: points
            };
        }).filter(Boolean);

    }, [selectedEfforts, streams, xAxisType]);


    if (allEfforts.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div
                className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setChartsExpanded(!chartsExpanded)}
            >
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Activity size={18} />
                    表現分析圖表
                    {segment && (
                        <span className="text-sm font-normal text-slate-500 ml-2">
                            {segment.name} · {(segment.distance / 1000).toFixed(1)}km · {segment.total_elevation_gain}m
                        </span>
                    )}
                </h3>
                {chartsExpanded ? <ChevronsUp size={18} /> : <ChevronsDown size={18} />}
            </div>

            {chartsExpanded && (
                <div className="p-4 space-y-8">
                    {/* 1. Historical Trend */}
                    <div className="h-[300px]">
                        <h4 className="text-sm font-semibold text-slate-600 mb-2">歷史趨勢 (時間 & 功率)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={trendData}
                                onClick={(state: any) => {
                                    if (state && state.activePayload && state.activePayload.length > 0) {
                                        const payload = state.activePayload[0].payload;
                                        if (onToggleEffort) onToggleEffort(payload.id);
                                    }
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="dateStr"
                                    tick={{ fontSize: 12 }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    label={{ value: '時間 (秒)', angle: -90, position: 'insideLeft' }}
                                    domain={['auto', 'auto']}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    label={{ value: '功率 (W)', angle: 90, position: 'insideRight' }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm z-50">
                                                    <p className="font-bold text-slate-700 mb-1">{data.dateStr}</p>
                                                    <p className="font-medium text-slate-900 mb-2 truncate max-w-[200px]">{data.activityName}</p>
                                                    <div className="space-y-1">
                                                        <p className="text-blue-500">時間: {data.time} s</p>
                                                        {data.watts && <p className="text-amber-500">功率: {data.watts} W</p>}
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">
                                                        點擊切換選取狀態
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="time"
                                    name="時間"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6, cursor: 'pointer' }}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="watts"
                                    name="功率"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    connectNulls
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6, cursor: 'pointer' }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 2. Detailed Comparison */}
                    {selectedEfforts.length > 0 && (
                        <div className="pt-6 border-t border-slate-200">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-600 mb-1">TCU詳細數據比較</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2 text-sm text-slate-500">
                                        <label className="flex items-center gap-1 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={visibleSeries.power}
                                                onChange={e => setVisibleSeries(prev => ({ ...prev, power: e.target.checked }))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            功率
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={visibleSeries.heartrate}
                                                onChange={e => setVisibleSeries(prev => ({ ...prev, heartrate: e.target.checked }))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            心率
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={visibleSeries.speed}
                                                onChange={e => setVisibleSeries(prev => ({ ...prev, speed: e.target.checked }))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            速度
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={visibleSeries.time}
                                                onChange={e => setVisibleSeries(prev => ({ ...prev, time: e.target.checked }))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            時間
                                        </label>
                                    </div>

                                </div>
                            </div>

                            {/* Warning for missing data */}
                            {!loading && selectedEfforts.length > comparisonData.length && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-2 text-amber-500 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">⚠️ 注意：</span>
                                        <span>
                                            有 {selectedEfforts.length - comparisonData.length} 筆活動因缺少詳細串流數據而無法顯示在圖表中。
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 ml-6">
                                        {selectedEfforts
                                            .filter(e => !streams[e.activity_id])
                                            .map(effort => {
                                                const status = syncStatus[effort.activity_id] || 'idle';
                                                return (
                                                    <div key={effort.activity_id} className="flex items-center gap-2 bg-amber-500/10 px-2 py-1 rounded">
                                                        <span className="text-xs text-amber-600">{format(new Date(effort.start_date), 'yyyy-MM-dd')}</span>
                                                        {status === 'success' ? (
                                                            <span className="flex items-center gap-1 text-emerald-600 text-xs">
                                                                <CheckCircle size={12} /> 已同步
                                                            </span>
                                                        ) : status === 'syncing' ? (
                                                            <span className="flex items-center gap-1 text-blue-600 text-xs">
                                                                <RefreshCw size={12} className="animate-spin" /> 同步中...
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => onSync?.(effort.activity_id)}
                                                                className="flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 px-1.5 py-0.5 rounded transition-colors"
                                                            >
                                                                <RefreshCw size={12} />
                                                                同步數據
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {loading ? (
                                <div className="h-[400px] flex items-center justify-center text-slate-400">
                                    載入數據中...
                                </div>
                            ) : comparisonData.length === 0 ? (
                                <div className="h-[400px] flex items-center justify-center text-slate-400">
                                    無串流數據可供顯示
                                </div>
                            ) : (
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="x"
                                                type="number"
                                                unit={xAxisType === 'distance' ? 'm' : 's'}
                                                domain={['dataMin', 'dataMax']}
                                                allowDataOverflow
                                            />
                                            {visibleSeries.elevation && (
                                                <YAxis
                                                    yAxisId="alt"
                                                    orientation="right"
                                                    hide
                                                    domain={['auto', 'auto']}
                                                />
                                            )}
                                            {visibleSeries.time && (
                                                <YAxis
                                                    yAxisId="time"
                                                    orientation="right"
                                                    label={{ value: '時間 (s)', angle: 90, position: 'insideRight' }}
                                                    domain={['auto', 'auto']}
                                                />
                                            )}
                                            <YAxis
                                                yAxisId="main"
                                                label={{ value: '功率/心率', angle: -90, position: 'insideLeft' }}
                                                domain={[0, 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} />

                                            {/* Background Elevation Area (using the first effort for context) */}
                                            {visibleSeries.elevation && comparisonData[0] && (
                                                <Area
                                                    yAxisId="alt"
                                                    data={comparisonData[0].data}
                                                    dataKey="alt"
                                                    name="海拔"
                                                    fill="#e2e8f0"
                                                    stroke="none"
                                                    fillOpacity={0.3}
                                                    isAnimationActive={false}
                                                />
                                            )}

                                            {/* Lines for each selected effort */}
                                            {comparisonData.map((series: any) => (
                                                <React.Fragment key={series.id}>
                                                    {visibleSeries.power && (
                                                        <Line
                                                            yAxisId="main"
                                                            data={series.data}
                                                            dataKey="power"
                                                            name={`${series.name} (W)`}
                                                            stroke={series.color}
                                                            strokeWidth={2}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {visibleSeries.heartrate && (
                                                        <Line
                                                            yAxisId="main"
                                                            data={series.data}
                                                            dataKey="hr"
                                                            name={`${series.name} (BPM)`}
                                                            stroke={series.color}
                                                            strokeWidth={1}
                                                            strokeDasharray="3 3"
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {visibleSeries.speed && (
                                                        <Line
                                                            yAxisId="main"
                                                            data={series.data}
                                                            dataKey="speed"
                                                            name={`${series.name} (km/h)`}
                                                            stroke={series.color}
                                                            strokeWidth={1}
                                                            strokeDasharray="5 5"
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {visibleSeries.time && (
                                                        <Line
                                                            yAxisId="time"
                                                            data={series.data}
                                                            dataKey="time"
                                                            name={`${series.name} (時間)`}
                                                            stroke={series.color}
                                                            strokeWidth={1}
                                                            strokeDasharray="4 2"
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                </React.Fragment>
                                            ))}

                                            <Brush height={30} stroke="#cbd5e1" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                            )}



                            {/* Segment Info at the bottom */}
                            {segment && (
                                <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
                                    <span className="flex items-center gap-1">
                                        <span className="font-medium text-slate-600">ID:</span> {segment.id}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="font-medium text-slate-600">路段:</span> {segment.name}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="font-medium text-slate-600">距離:</span> {(segment.distance / 1000).toFixed(2)} km
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="font-medium text-slate-600">爬升:</span> {segment.total_elevation_gain} m
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                    }
                </div>
            )}
        </div>
    );
};


