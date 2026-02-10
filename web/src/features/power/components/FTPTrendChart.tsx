import React, { useMemo } from 'react';
import {
    ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, Legend
} from 'recharts';
import { format, parseISO, isSameDay } from 'date-fns';
import { Target, Zap } from 'lucide-react';
import type { StravaActivity } from '../../../types';

interface FTPTrendChartProps {
    data: { date: string; ftp: number }[];
    activities?: StravaActivity[];
    currentFtp: number;
}

export function FTPTrendChart({ data, activities = [], currentFtp }: FTPTrendChartProps) {
    // Merge FTP history with Activity Data
    const chartData = useMemo(() => {
        const baseData = data.length > 0 ? data : generateMockData(currentFtp);

        return baseData.map(point => {
            const pointDate = parseISO(point.date);
            
            // Find max activity effort on this day
            const dayActivities = activities.filter(a => 
                isSameDay(parseISO(a.start_date), pointDate)
            );
            
            if (dayActivities.length === 0) return point;

            // Use Weighted Avg Power (NP) as an intensity metric
            const bestActivity = dayActivities.reduce((best, act) => {
                const pwr = act.weighted_average_watts || act.average_watts || 0;
                const currentMax = best.weighted_average_watts || best.average_watts || 0;
                return pwr > currentMax ? act : best;
            }, dayActivities[0]);

            const power = bestActivity.weighted_average_watts || bestActivity.average_watts || 0;

            return {
                ...point,
                activityPower: power > 0 ? power : null,
                activityName: bestActivity.name,
                activityId: bestActivity.id
            };
        });
    }, [data, activities, currentFtp]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
                    <p className="text-slate-400 mb-2">{format(parseISO(label), 'yyyy/MM/dd')}</p>
                    {payload.map((entry: any, index: number) => {
                        if (entry.dataKey === 'ftp') {
                            return (
                                <div key={index} className="flex items-center gap-2 text-blue-400 mb-1">
                                    <Target className="w-3 h-3" />
                                    <span>設定 FTP: {entry.value}W</span>
                                </div>
                            );
                        }
                        if (entry.dataKey === 'activityPower') {
                            return (
                                <div key={index} className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-800">
                                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                                        <Zap className="w-3 h-3" />
                                        <span>活動強度: {entry.value}W (NP)</span>
                                    </div>
                                    <div className="text-slate-500 max-w-[200px] truncate">
                                        {entry.payload.activityName}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 h-[400px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        FTP 趨勢 & 活動強度
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">藍線: FTP 設定 | 紫點: 單次活動標準化功率 (NP)</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-black text-blue-500 font-mono">
                        {currentFtp}<span className="text-sm text-slate-500 ml-1">W</span>
                    </div>
                    <div className="text-xs text-slate-500">
                        目前 FTP
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(val) => format(parseISO(val), 'MM/dd')}
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={['dataMin - 20', 'dataMax + 20']}
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                            unit="W"
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        
                        {/* FTP Line */}
                        <Line
                            type="stepAfter"
                            dataKey="ftp"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                            name="FTP 設定"
                        />
                        
                        {/* Activity Scatter Points */}
                        <Scatter 
                            dataKey="activityPower" 
                            fill="#a855f7" 
                            shape="circle"
                            name="活動強度 (NP)"
                            isAnimationActive={false}
                        />

                        <ReferenceLine y={currentFtp} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.3} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function generateMockData(current: number) {
    const data = [];
    const now = new Date();
    for (let i = 42; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        data.push({
            date: d.toISOString().split('T')[0],
            ftp: current
        });
    }
    return data;
}