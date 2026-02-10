/**
 * FTP 趨勢圖表
 * 
 * 追蹤歷史 FTP 變化，根據 Strava Streams 中記錄的 FTP 快照
 * 以及活動的 NP/IF 推估 FTP 趨勢。
 */

import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface FTPHistoryPoint {
    date: string;         // ISO 日期
    ftp: number;          // 當時的 FTP
    source: 'recorded' | 'estimated'; // 來源：實際紀錄 or 推估
    activityName?: string;
}

interface FTPTrendChartProps {
    history: FTPHistoryPoint[];
    currentFTP: number;
}

export const FTPTrendChart: React.FC<FTPTrendChartProps> = ({ history, currentFTP }) => {
    const chartData = useMemo(() => {
        if (history.length === 0) return [];

        return history
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(h => ({
                ...h,
                dateLabel: format(new Date(h.date), 'MM/dd'),
                dateShort: format(new Date(h.date), 'yyyy-MM-dd'),
            }));
    }, [history]);

    // 計算趨勢
    const trend = useMemo(() => {
        if (chartData.length < 2) return { direction: 'stable' as const, delta: 0 };
        const recent = chartData[chartData.length - 1].ftp;
        const oldest = chartData[0].ftp;
        const delta = recent - oldest;
        const direction = delta > 5 ? 'up' as const : delta < -5 ? 'down' as const : 'stable' as const;
        return { direction, delta };
    }, [chartData]);

    if (chartData.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p className="text-sm font-medium">尚無 FTP 歷史數據</p>
                <p className="text-xs mt-1">需要在活動分析中設定 FTP 才能追蹤趨勢</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 摘要 */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">目前 FTP:</span>
                    <span className="text-xl font-black text-blue-400">{currentFTP}<span className="text-sm text-slate-500 ml-0.5">W</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                    {trend.direction === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                    {trend.direction === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
                    {trend.direction === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
                    <span className={`text-xs font-bold ${trend.direction === 'up' ? 'text-emerald-400' :
                            trend.direction === 'down' ? 'text-red-400' : 'text-slate-400'
                        }`}>
                        {trend.delta > 0 ? '+' : ''}{trend.delta}W
                    </span>
                </div>
            </div>

            {/* 圖表 */}
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="dateLabel"
                            stroke="#94a3b8"
                            tick={{ fontSize: 10, fontWeight: 600 }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 10 }}
                            domain={['auto', 'auto']}
                            tickFormatter={(v) => `${v}W`}
                        />
                        {currentFTP > 0 && (
                            <ReferenceLine
                                y={currentFTP}
                                stroke="#3B82F6"
                                strokeDasharray="5 5"
                                strokeWidth={1}
                            />
                        )}
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#334155',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                fontSize: '12px',
                            }}
                            formatter={(value: any, _name: string) => [`${value} W`, 'FTP']}
                            labelFormatter={(label) => label}
                        />
                        <Line
                            type="monotone"
                            dataKey="ftp"
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
                            activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
