/**
 * 週/月訓練量統計圖表
 * 
 * 以柱狀圖呈現每週 TSS 累積量，搭配 CTL/ATL 趨勢。
 */

import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { format, endOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface DailyTSS {
    date: string;
    tss: number;
    activityCount: number;
}

interface TrainingVolChartProps {
    dailyTSSData: DailyTSS[];
}

// TSS 顏色分級 (根據週 TSS 強度)
const getTSSColor = (weeklyTSS: number): string => {
    if (weeklyTSS < 200) return '#34D399'; // 低負荷
    if (weeklyTSS < 400) return '#60A5FA'; // 中低負荷
    if (weeklyTSS < 600) return '#FBBF24'; // 中等負荷
    if (weeklyTSS < 800) return '#F97316'; // 高負荷
    return '#EF4444'; // 極高負荷
};

const getTSSLabel = (weeklyTSS: number): string => {
    if (weeklyTSS < 200) return '恢復';
    if (weeklyTSS < 400) return '維持';
    if (weeklyTSS < 600) return '建設';
    if (weeklyTSS < 800) return '高強度';
    return '超負荷';
};

export const TrainingVolumeChart: React.FC<TrainingVolChartProps> = ({ dailyTSSData }) => {
    const [weekCount, setWeekCount] = useState<8 | 12 | 24>(12);

    const weeklyData = useMemo(() => {
        if (dailyTSSData.length === 0) return [];

        const now = new Date();
        const startDate = subWeeks(now, weekCount);

        // 生成每週的區間
        const weeks = eachWeekOfInterval(
            { start: startDate, end: now },
            { weekStartsOn: 1 } // 週一開始
        );

        return weeks.map(weekStart => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            const weekLabel = format(weekStart, 'MM/dd', { locale: zhTW });

            // 累積這一週的 TSS
            const weekTSS = dailyTSSData
                .filter(d => {
                    const date = new Date(d.date);
                    return date >= weekStart && date <= weekEnd;
                })
                .reduce((sum, d) => sum + d.tss, 0);

            const weekActivities = dailyTSSData
                .filter(d => {
                    const date = new Date(d.date);
                    return date >= weekStart && date <= weekEnd;
                })
                .reduce((sum, d) => sum + d.activityCount, 0);

            return {
                week: weekLabel,
                tss: Math.round(weekTSS),
                activities: weekActivities,
                color: getTSSColor(weekTSS),
                label: getTSSLabel(weekTSS),
            };
        });
    }, [dailyTSSData, weekCount]);

    // 統計摘要
    const summary = useMemo(() => {
        if (weeklyData.length === 0) return null;
        const totalTSS = weeklyData.reduce((s, w) => s + w.tss, 0);
        const avgTSS = Math.round(totalTSS / weeklyData.length);
        const maxTSS = Math.max(...weeklyData.map(w => w.tss));
        const totalActivities = weeklyData.reduce((s, w) => s + w.activities, 0);
        return { totalTSS, avgTSS, maxTSS, totalActivities };
    }, [weeklyData]);

    if (weeklyData.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">目前尚無足夠的訓練數據</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 週期選擇 & 摘要 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                    {summary && (
                        <>
                            <span className="text-slate-500">
                                平均 <span className="text-white font-bold">{summary.avgTSS}</span> TSS/週
                            </span>
                            <span className="text-slate-500">
                                最高 <span className="text-yellow-400 font-bold">{summary.maxTSS}</span> TSS/週
                            </span>
                            <span className="text-slate-500">
                                共 <span className="text-white font-bold">{summary.totalActivities}</span> 次騎乘
                            </span>
                        </>
                    )}
                </div>
                <div className="flex gap-1">
                    {([8, 12, 24] as const).map(n => (
                        <button
                            key={n}
                            onClick={() => setWeekCount(n)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${weekCount === n
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {n}週
                        </button>
                    ))}
                </div>
            </div>

            {/* 柱狀圖 */}
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="week"
                            stroke="#94a3b8"
                            tick={{ fontSize: 9, fontWeight: 600 }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                fontSize: '12px',
                            }}
                            formatter={(value: number) => [`${value} TSS`, '週訓練負荷']}
                            labelFormatter={(label) => `第 ${label} 週起`}
                        />
                        <Bar dataKey="tss" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {weeklyData.map((entry, index) => (
                                <Cell key={index} fill={entry.color} fillOpacity={0.85} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 負荷等級圖例 */}
            <div className="flex flex-wrap justify-center gap-3 text-[10px]">
                {[
                    { label: '恢復 <200', color: '#34D399' },
                    { label: '維持 200-400', color: '#60A5FA' },
                    { label: '建設 400-600', color: '#FBBF24' },
                    { label: '高強度 600-800', color: '#F97316' },
                    { label: '超負荷 800+', color: '#EF4444' },
                ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                        <span className="text-slate-500">{l.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
