
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
import { ChevronsDown, ChevronsUp, Activity, RefreshCw, CheckCircle, Info } from 'lucide-react';

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
    // Explicitly defining unused variable to keep linter happy or removing it if not needed.
    // const xAxisType = 'distance'; 
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


    // 2. Interpolation Helper
    const interpolate = (x: number, xArray: number[], yArray: number[]) => {
        if (!xArray || !yArray || xArray.length === 0 || yArray.length === 0) return 0;

        // Binary search or find index
        if (x <= xArray[0]) return yArray[0];
        if (x >= xArray[xArray.length - 1]) return yArray[yArray.length - 1];

        // Find index i where xArray[i] <= x < xArray[i+1]
        let i = 0;
        let j = xArray.length - 1;

        while (i < j) {
            const mid = Math.floor((i + j) / 2);
            if (xArray[mid] < x) {
                if (xArray[mid + 1] >= x) {
                    i = mid;
                    break;
                }
                i = mid + 1;
            } else {
                j = mid;
            }
        }

        const x0 = xArray[i];
        const x1 = xArray[i + 1];
        const y0 = yArray[i];
        const y1 = yArray[i + 1];

        if (x1 === x0) return y0;

        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    };


    // 3. Unified Comparison Data
    const unifiedData = useMemo(() => {
        if (selectedEfforts.length === 0) return [];

        // Identify available streams and determining domain
        const validEfforts = selectedEfforts.filter(e => streams[e.activity_id]);
        if (validEfforts.length === 0) return [];

        let maxDistance = 0;


        // Pre-process streams to normalize distance and find max
        const processedStreams: any[] = validEfforts.map(effort => {

            const s = streams[effort.activity_id];
            // Safe access w/ defaulting
            const dist = s && s.distance ? s.distance : [];
            const time = s && s.time ? s.time : [];

            if (dist.length === 0) {
                return null;
            }

            const startDist = dist[0];
            const startTime = time.length > 0 ? time[0] : 0;

            const normalizedDist = dist.map((d: number) => d - startDist);
            const normalizedTime = time.map((t: number) => t - startTime);

            const lastDist = normalizedDist[normalizedDist.length - 1] || 0;
            if (lastDist > maxDistance) maxDistance = lastDist;

            // Use watts_calc if watts is missing (common in some Strava activities)
            const powerStream = s.watts || s.watts_calc || [];

            return {
                id: effort.activity_id,
                dist: normalizedDist,
                time: normalizedTime,
                power: powerStream,
                hr: s.heartrate || [],
                alt: s.altitude || [],
                speed: s.velocity_smooth || [],
                cad: s.cadence || []
            };
        }).filter(Boolean) as NonNullable<typeof processedStreams[0]>[];

        if (processedStreams.length === 0) return [];

        // Limit max distance to segment distance + 5% if segment is defined
        if (segment) {
            const segMax = segment.distance * 1.05;
            maxDistance = Math.min(maxDistance, segMax);
        }

        // Sampling Rate
        // If we generate too many points, performance suffers. target ~500 points
        const SAMPLE_POINTS = 500;
        const step = maxDistance / SAMPLE_POINTS;

        const result = [];
        for (let x = 0; x <= maxDistance; x += step) {
            const point: any = { x: Math.round(x) }; // X is Distance

            // For each effort, interpolate values at distance X
            processedStreams.forEach(stream => {
                // Check if X is within this effort's range (or close enough)
                const lastEffortDist = stream.dist[stream.dist.length - 1];
                if (x > lastEffortDist) {
                    return;
                }

                // Only interpolate if stream has data
                if (stream.power.length > 0) point[`power_${stream.id}`] = Math.round(interpolate(x, stream.dist, stream.power));
                if (stream.hr.length > 0) point[`hr_${stream.id}`] = Math.round(interpolate(x, stream.dist, stream.hr));
                if (stream.alt.length > 0) point[`alt_${stream.id}`] = interpolate(x, stream.dist, stream.alt);
                if (stream.speed.length > 0) point[`speed_${stream.id}`] = Math.round(interpolate(x, stream.dist, stream.speed) * 3.6 * 10) / 10; // m/s to km/h
                if (stream.time.length > 0) point[`time_${stream.id}`] = Math.round(interpolate(x, stream.dist, stream.time));
            });

            // For shared background elevation, take the average of all available altitudes or the first one
            // Ideally use the official segment altitude if available, but we don't have it as a stream
            // Use the first effort's altitude as reference
            if (processedStreams.length > 0 && processedStreams[0].alt.length > 0) {
                point.alt_ref = point[`alt_${processedStreams[0].id}`];
            } else if (processedStreams.length > 1 && processedStreams[1].alt.length > 0) {
                point.alt_ref = point[`alt_${processedStreams[1].id}`];
            }

            result.push(point);
        }

        return result;

    }, [selectedEfforts, streams, segment]);


    if (allEfforts.length === 0) return null;

    // Custom Dot for Trend Chart
    const CustomDot = (props: any) => {
        const { cx, cy, payload, stroke } = props;
        const selectedIndex = selectedEfforts.findIndex(e => e.activity_id === payload.id);
        const isSelected = selectedIndex !== -1;

        if (isSelected) {
            const color = COLORS[selectedIndex % COLORS.length];
            return (
                <circle cx={cx} cy={cy} r={6} stroke={color} strokeWidth={3} fill={color} />
            );
        }
        return (
            <circle cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={1.5} fill="white" />
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div
                className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setChartsExpanded(!chartsExpanded)}
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Activity size={18} />
                        表現分析圖表
                        {segment && (
                            <span className="text-sm font-normal text-slate-500 ml-2">
                                {segment.name} · {(segment.distance / 1000).toFixed(1)}km · {segment.total_elevation_gain}m
                            </span>
                        )}
                    </h3>

                </div>
                {chartsExpanded ? <ChevronsUp size={18} /> : <ChevronsDown size={18} />}
            </div>

            {chartsExpanded && (
                <div className="p-4 space-y-8">
                    {/* 1. Historical Trend (Unchanged) */}
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
                                    label={{ value: '功率 (W)', angle: -90, position: 'insideRight' }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const selectedIndex = selectedEfforts.findIndex(e => e.activity_id === data.id);
                                            const isSelected = selectedIndex !== -1;
                                            const color = isSelected ? COLORS[selectedIndex % COLORS.length] : undefined;

                                            return (
                                                <div
                                                    className="bg-white p-3 shadow-lg rounded-lg text-sm z-50 border"
                                                    style={{
                                                        borderColor: color || '#e2e8f0',
                                                        borderWidth: isSelected ? '2px' : '1px'
                                                    }}
                                                >
                                                    <p className="font-bold text-slate-700 mb-1">{data.dateStr}</p>
                                                    <p className="font-medium text-slate-900 mb-2 truncate max-w-[200px]">{data.activityName}</p>
                                                    <div className="space-y-1">
                                                        <p className="text-blue-500">時間: {data.time} s</p>
                                                        {data.watts && <p className="text-amber-500">功率: {data.watts} W</p>}
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-400">
                                                        {isSelected ? '點擊取消選取' : '點擊選取'}
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
                                    dot={<CustomDot />}
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
                                    dot={<CustomDot />}
                                    activeDot={{ r: 6, cursor: 'pointer' }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 2. Detailed Comparison */}
                    {selectedEfforts.length > 0 && (
                        <div className="pt-6 border-t border-slate-200">
                            <div className="relative flex flex-col md:flex-row items-center justify-center mb-4 w-full">
                                <h4 className="text-sm font-bold text-slate-600">TCU詳細數據比較</h4>
                                <div className="md:absolute md:right-0 flex items-center gap-4 mt-2 md:mt-0">
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
                            {!loading && selectedEfforts.length > unifiedData.length && selectedEfforts.length > 0 && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex flex-col gap-2 text-amber-500 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Info size={16} />
                                        <span>
                                            部分活動因缺少詳細串流數據而隱藏。
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
                            ) : unifiedData.length === 0 ? (
                                <div className="h-[400px] flex items-center justify-center text-slate-400">
                                    無有效數據可供顯示
                                </div>
                            ) : (
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={unifiedData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="x"
                                                type="number"
                                                unit="m"
                                                domain={['dataMin', 'dataMax']}
                                                tickFormatter={(value) => Math.round(value).toString()}
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
                                                labelFormatter={(value) => `距離: ${Math.round(value)}m`}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36} />

                                            {/* Background Elevation Area (Shared Reference) */}
                                            {visibleSeries.elevation && (
                                                <Area
                                                    yAxisId="alt"
                                                    dataKey="alt_ref"
                                                    name="海拔 (參考)"
                                                    fill="#e2e8f0"
                                                    stroke="none"
                                                    fillOpacity={0.3}
                                                    isAnimationActive={false}
                                                />
                                            )}

                                            {/* Lines for each selected effort */}
                                            {selectedEfforts
                                                .filter(e => streams[e.activity_id])
                                                .map((effort, index) => {
                                                    const color = COLORS[index % COLORS.length];
                                                    const dateLabel = format(new Date(effort.start_date), 'yyyy-MM-dd');

                                                    return (
                                                        <React.Fragment key={effort.activity_id}>
                                                            {visibleSeries.power && (
                                                                <Line
                                                                    yAxisId="main"
                                                                    dataKey={`power_${effort.activity_id}`}
                                                                    name={`${dateLabel} (W)`}
                                                                    stroke={color}
                                                                    strokeWidth={2}
                                                                    dot={false}
                                                                    isAnimationActive={false}
                                                                    connectNulls
                                                                />
                                                            )}
                                                            {visibleSeries.heartrate && (
                                                                <Line
                                                                    yAxisId="main"
                                                                    dataKey={`hr_${effort.activity_id}`}
                                                                    name={`${dateLabel} (BPM)`}
                                                                    stroke={color}
                                                                    strokeWidth={1}
                                                                    strokeDasharray="3 3"
                                                                    dot={false}
                                                                    isAnimationActive={false}
                                                                    connectNulls
                                                                />
                                                            )}
                                                            {visibleSeries.speed && (
                                                                <Line
                                                                    yAxisId="main"
                                                                    dataKey={`speed_${effort.activity_id}`}
                                                                    name={`${dateLabel} (km/h)`}
                                                                    stroke={color}
                                                                    strokeWidth={1}
                                                                    strokeDasharray="5 5"
                                                                    dot={false}
                                                                    isAnimationActive={false}
                                                                    connectNulls
                                                                />
                                                            )}
                                                            {visibleSeries.time && (
                                                                <Line
                                                                    yAxisId="time"
                                                                    dataKey={`time_${effort.activity_id}`}
                                                                    name={`${dateLabel} (時間)`}
                                                                    stroke={color}
                                                                    strokeWidth={1}
                                                                    strokeDasharray="4 2"
                                                                    dot={false}
                                                                    isAnimationActive={false}
                                                                    connectNulls
                                                                />
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}

                                            <Brush height={30} stroke="#cbd5e1" dataKey="x" tickFormatter={(v) => `${Math.round(v)}m`} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                            )}

                            {/* Segment Info at the bottom (Unchanged) */}
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
                                    <span className="flex items-center gap-1 font-bold text-orange-500">
                                        Powered by TCU
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                    }
                </div>
            )
            }
        </div >
    );
};
