import React, { useState, useMemo } from 'react';
import { Zap, Heart, Activity, TrendingUp, ZoomOut } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts';
import { formatDuration } from '../../../utils/formatters';
import type { ActivityPowerAnalysis } from '../../../types';

// 活動趨勢圖表組件
export const ActivityCharts: React.FC<{ data: ActivityPowerAnalysis }> = ({ data }) => {
    // 預設顯示指標
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['watts', 'heartrate', 'speed', 'altitude']);

    // 定義所有可用指標
    const metrics_config = [
        { key: 'watts', label: '功率 (W)', color: '#EAB308', icon: Zap },
        { key: 'heartrate', label: '心率 (bpm)', color: '#EF4444', icon: Heart },
        { key: 'cadence', label: '踏頻 (rpm)', color: '#3B82F6', icon: Activity },
        { key: 'speed', label: '速度 (km/h)', color: '#06b6d4', icon: Zap },
        { key: 'altitude', label: '海拔 (m)', color: '#10b981', icon: TrendingUp },
        { key: 'grade', label: '坡度 (%)', color: '#A855F7', icon: TrendingUp },
        { key: 'temp', label: '溫度 (°C)', color: '#F97316', icon: TrendingUp },
    ];

    // 切換指標顯示
    const toggleMetric = (key: string) => {
        setSelectedMetrics(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    // 轉換數據格式供 Recharts 使用 (每 10 秒取樣一次以優化效能)
    const chartData = useMemo(() => {
        if (!data?.timeSeriesData) return [];
        const { time, watts, heartrate, cadence, grade, velocity, altitude, temp } = data.timeSeriesData;
        const result = [];
        // 取樣頻率：每 10 點取 1 點
        for (let i = 0; i < time.length; i += 10) {
            result.push({
                time: time[i],
                timeStr: formatDuration(time[i]),
                watts: watts[i],
                heartrate: heartrate?.[i] || 0,
                cadence: cadence?.[i] || 0,
                grade: grade?.[i] || 0,
                speed: velocity?.[i] ? Number((velocity[i] * 3.6).toFixed(1)) : 0, // m/s -> km/h
                altitude: altitude?.[i] || 0,
                temp: temp?.[i] || null, // 溫度可能為空
            });
        }
        return result;
    }, [data]);

    // 縮放狀態
    const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
    const [left, setLeft] = useState<'dataMin' | number>('dataMin');
    const [right, setRight] = useState<'dataMax' | number>('dataMax');

    // 重置縮放
    const zoomOut = () => {
        setRefAreaLeft(null);
        setRefAreaRight(null);
        setLeft('dataMin');
        setRight('dataMax');
    };

    // 執行縮放
    const zoom = () => {
        if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
            setRefAreaLeft(null);
            setRefAreaRight(null);
            return;
        }

        // 確保 left < right
        let start = refAreaLeft;
        let end = refAreaRight;

        if (start > end) {
            [start, end] = [end, start];
        }

        setRefAreaLeft(null);
        setRefAreaRight(null);
        setLeft(start);
        setRight(end);
    };

    if (chartData.length === 0) return null;

    return (
        <div className="w-full mt-6">
            {/* 指標切換工具列 */}
            <div className="flex flex-wrap justify-center gap-4 mb-4">
                {metrics_config.map(metric => {
                    const isActive = selectedMetrics.includes(metric.key);
                    return (
                        <button
                            key={metric.key}
                            onClick={() => toggleMetric(metric.key)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-300 border ${isActive
                                ? `bg-opacity-20 border-opacity-50 text-white`
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'
                                }`}
                            style={{
                                backgroundColor: isActive ? `${metric.color}20` : undefined,
                                borderColor: isActive ? metric.color : undefined,
                            }}
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: isActive ? metric.color : '#64748b' }}
                            />
                            {metric.label}
                        </button>
                    );
                })}
            </div>

            <div className="h-[400px] w-full min-w-0 overflow-hidden select-none cursor-crosshair" style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer width="100%" height={400} minWidth={0}>
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        onMouseDown={(e) => {
                            if (e && e.activeLabel) setRefAreaLeft(Number(e.activeLabel));
                        }}
                        onMouseMove={(e) => {
                            if (e && e.activeLabel && refAreaLeft !== null) {
                                const val = Number(e.activeLabel);
                                // 簡單優化：只有數值改變才更新 (但在 Number Axis 下可能是連續的，差異不大，但加上 check 比較保險)
                                setRefAreaRight(val);
                            }
                        }}
                        onMouseUp={zoom}
                    >
                        <defs>
                            <linearGradient id="colorWatts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCadence" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorAltitude" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="time"
                            type="number"
                            stroke="#94a3b8"
                            tick={{ fontSize: 10 }}
                            tickFormatter={formatDuration}
                            interval="preserveStartEnd"
                            minTickGap={50}
                            domain={[left, right]}
                            allowDataOverflow
                        />

                        {/* Y Axes - conditionally rendered but maintain ID stability */}
                        <YAxis yAxisId="watts" stroke="#EAB308" hide domain={[0, 'auto']} />
                        <YAxis yAxisId="hr" stroke="#EF4444" hide domain={[0, 220]} />
                        <YAxis yAxisId="cadence" stroke="#3B82F6" hide domain={[0, 150]} />
                        <YAxis yAxisId="speed" stroke="#06b6d4" hide domain={[0, 100]} />
                        <YAxis yAxisId="altitude" stroke="#10b981" hide domain={['auto', 'auto']} />
                        <YAxis yAxisId="grade" stroke="#A855F7" hide domain={[-20, 20]} />
                        <YAxis yAxisId="temp" stroke="#F97316" hide domain={['auto', 'auto']} />

                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                            itemStyle={{ padding: 0 }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '0.5rem' }}
                            labelFormatter={(label) => formatDuration(Number(label))}
                            formatter={(value: number | string, name: string) => {
                                const activeName = name || '';
                                if (value === undefined || value === null) return [0, activeName];
                                if (activeName === 'watts') return [`${value}W`, '功率'];
                                if (activeName === 'heartrate') return [`${value}bpm`, '心率'];
                                if (activeName === 'cadence') return [`${value}rpm`, '踏頻'];
                                if (activeName === 'speed') return [`${value}km/h`, '速度'];
                                if (activeName === 'altitude') return [`${value}m`, '海拔'];
                                if (activeName === 'grade') return [`${value}%`, '坡度'];
                                if (activeName === 'temp') return [`${value}°C`, '溫度'];
                                return [value, activeName];
                            }}
                        />

                        {/* Areas - conditionally rendered */}
                        {selectedMetrics.includes('watts') && (
                            <Area
                                yAxisId="watts"
                                type="monotone"
                                dataKey="watts"
                                stroke="#EAB308"
                                fillOpacity={1}
                                fill="url(#colorWatts)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('heartrate') && (
                            <Area
                                yAxisId="hr"
                                type="monotone"
                                dataKey="heartrate"
                                stroke="#EF4444"
                                fillOpacity={1}
                                fill="url(#colorHr)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('cadence') && (
                            <Area
                                yAxisId="cadence"
                                type="monotone"
                                dataKey="cadence"
                                stroke="#3B82F6"
                                fillOpacity={1}
                                fill="url(#colorCadence)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('speed') && (
                            <Area
                                yAxisId="speed"
                                type="monotone"
                                dataKey="speed"
                                stroke="#06b6d4"
                                fillOpacity={1}
                                fill="url(#colorSpeed)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('altitude') && (
                            <Area
                                yAxisId="altitude"
                                type="monotone"
                                dataKey="altitude"
                                stroke="#10b981"
                                fillOpacity={0.4}
                                fill="url(#colorAltitude)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('grade') && (
                            <Area
                                yAxisId="grade"
                                type="monotone"
                                dataKey="grade"
                                stroke="#A855F7"
                                fillOpacity={1}
                                fill="url(#colorGrade)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                            />
                        )}
                        {selectedMetrics.includes('temp') && (
                            <Area
                                yAxisId="temp"
                                type="monotone"
                                dataKey="temp"
                                stroke="#F97316"
                                fillOpacity={1}
                                fill="url(#colorTemp)"
                                strokeWidth={1.5}
                                activeDot={{ r: 4 }}
                                animationDuration={500}
                                connectNulls
                            />
                        )}

                        {refAreaLeft !== null && refAreaRight !== null && (
                            // @ts-expect-error - ReferenceArea 型別定義與實際使用不完全匹配
                            <ReferenceArea
                                x1={refAreaLeft}
                                x2={refAreaRight}
                                fill="#000000"
                                fillOpacity={0.5}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 縮放提示與控制 */}
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-2">
                <div>
                    {left !== 'dataMin' ? (
                        <button
                            onClick={zoomOut}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-full transition-colors border border-slate-600"
                        >
                            <ZoomOut className="w-3 h-3" />
                            重置縮放
                        </button>
                    ) : (
                        <span>按住滑鼠左鍵拖曳選取範圍進行縮放</span>
                    )}
                </div>
            </div>
        </div>
    );
};
