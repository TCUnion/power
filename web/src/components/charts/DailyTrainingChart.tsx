
import React, { useMemo } from 'react';
import {
    BarChart,
} from 'lucide-react';
import {
    Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Line
} from 'recharts';
import type { StravaActivity } from '../../types';

interface DailyTrainingChartProps {
    activities: StravaActivity[];
    ftp: number;
}

// 每日訓練圖表 (過去 30 天)
export const DailyTrainingChart: React.FC<DailyTrainingChartProps> = ({ activities, ftp }) => {
    const data = useMemo(() => {
        const today = new Date();
        const days = 120;

        // 建立過去 120 天的日期 mapping
        const dateMap = new Map<string, { tss: number; duration: number; distance: number; dateStr: string; activities: number; totalHrTime: number; weightedHrSum: number; avgHr: number; activityNames: string[]; dayOfWeek: number }>();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            const displayDate = `${d.getMonth() + 1}/${d.getDate()}`;
            dateMap.set(dateStr, { tss: 0, duration: 0, distance: 0, dateStr: displayDate, activities: 0, totalHrTime: 0, weightedHrSum: 0, avgHr: 0, activityNames: [], dayOfWeek: d.getDay() });
        }

        // 聚合數據
        activities.forEach(activity => {
            const isRide = ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'Velomobile'].includes(activity.sport_type || 'Ride');
            if (!isRide) return;

            const dateStr = activity.start_date.split('T')[0];
            if (dateMap.has(dateStr)) {
                const dayData = dateMap.get(dateStr)!;

                // 使用標準 TSS 計算公式: (duration × NP × IF) / (FTP × 3600) × 100
                // 注意：suffer_score 是 Strava 的「相對努力度」，基於心率，不等於 TSS
                let tss = 0;
                if (ftp > 0 && (activity.average_watts || activity.weighted_average_watts)) {
                    const np = Number(activity.weighted_average_watts || (activity.average_watts ? activity.average_watts * 1.05 : 0));
                    if (np > 0) {
                        const intensity = np / ftp;
                        tss = (activity.moving_time * np * intensity) / (ftp * 3600) * 100;
                    }
                }

                // 計算加權平均心率
                const avgHr = activity.average_heartrate ? Number(activity.average_heartrate) : 0;
                if (activity.has_heartrate && avgHr > 0) {
                    dayData.weightedHrSum += avgHr * activity.moving_time;
                    dayData.totalHrTime += activity.moving_time;
                }

                dayData.tss += tss;
                dayData.duration += activity.moving_time;
                dayData.distance += activity.distance || 0;
                dayData.activities += 1;
                dayData.activityNames.push(activity.name);
            }
        });

        // 計算最終平均心率
        return Array.from(dateMap.values()).map(d => ({
            ...d,
            avgHr: d.totalHrTime > 0 ? Math.round(d.weightedHrSum / d.totalHrTime) : undefined // 無數據時為 undefined 讓線斷開
        }));
    }, [activities, ftp]);

    // 計算平均 TSS (用於參考線)
    const avgTSS = useMemo(() => {
        if (data.length === 0) return 0;
        const totalTSS = data.reduce((sum, d) => sum + d.tss, 0);
        return Math.round(totalTSS / data.length);
    }, [data]);

    return (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <BarChart className="w-4 h-4" />
                    過去 120 天訓練量 (TSS) & 心率
                </h3>
                <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        TSS
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        心率
                    </span>
                    <span className="text-slate-500">
                        120天日均 TSS: <span className="text-slate-300 font-mono">{avgTSS}</span>
                    </span>
                </div>
            </div>

            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="dateStr"
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            interval={4} // 每 5 天顯示一個刻度
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#f43f5e"
                            tick={{ fontSize: 10, fill: '#f43f5e' }}
                            tickLine={false}
                            axisLine={false}
                            domain={['dataMin - 10', 'dataMax + 10']}
                            hide={!data.some(d => d.avgHr)} // 防止無數據時顯示怪異刻度
                        />
                        <Tooltip
                            cursor={{ fill: '#334155', opacity: 0.2 }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
                                            <p className="text-slate-400 mb-2 font-medium border-b border-slate-700 pb-1">{label}</p>

                                            {/* 活動名稱列表 */}
                                            {data.activityNames && data.activityNames.length > 0 ? (
                                                <div className="mb-2 space-y-1">
                                                    {data.activityNames.map((name: string, i: number) => (
                                                        <div key={i} className="text-white font-medium truncate max-w-[200px]">
                                                            {name}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mb-2 text-slate-500 italic">無資料</div>
                                            )}

                                            <div className="space-y-1">
                                                {/* 心率 */}
                                                {data.avgHr && (
                                                    <div className="flex items-center gap-2 text-rose-400">
                                                        <span>心率 (bpm):</span>
                                                        <span className="font-mono font-bold">{data.avgHr}</span>
                                                    </div>
                                                )}
                                                {/* TSS */}
                                                <div className="flex items-center gap-2 text-blue-400">
                                                    <span>TSS:</span>
                                                    <span className="font-mono font-bold">{Math.round(data.tss)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <ReferenceLine yAxisId="left" y={avgTSS} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.5} />
                        <Bar yAxisId="left" dataKey="tss" name="tss" radius={[2, 2, 0, 0]} maxBarSize={40}>
                            {data.map((entry, index) => {
                                let color = '#3b82f6'; // Default Blue
                                if (entry.dayOfWeek === 6) color = '#22c55e'; // Saturday Green
                                if (entry.dayOfWeek === 0) color = '#ec4899'; // Sunday Pink

                                return <Cell key={`cell-${index}`} fill={entry.tss > 0 ? color : 'transparent'} />;
                            })}
                        </Bar>
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="avgHr"
                            name="avgHr"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: '#f43f5e', stroke: '#fff' }}
                            connectNulls={true}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* 簡易圖例/說明 */}
            {ftp === 0 && (
                <div className="mt-2 text-center text-[10px] text-orange-400 bg-orange-500/10 py-1 rounded">
                    * 尚未設定 FTP，無法計算訓練壓力 (TSS)。請點擊上方「無功率設定」進行設置。
                </div>
            )}
        </div>
    );
};
