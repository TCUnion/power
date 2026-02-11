
import React, { useMemo, useState, useEffect } from 'react';
import {
    Activity
} from 'lucide-react';
import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import type { StravaActivity } from '../../types';
import { format } from 'date-fns';
// import { zhTW } from 'date-fns/locale';

interface PMCChartProps {
    activities: StravaActivity[];
    ftp: number;
}

// 週期選項定義
// 週期選項定義
type PeriodOption = 14 | 28 | 42 | 90 | 180 | 365;
const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
    { value: 14, label: '14天' },
    { value: 28, label: '28天' },
    { value: 42, label: '42天' },
    { value: 90, label: '90天' },
    { value: 180, label: '180天' },
    { value: 365, label: '365天' },
];

// 體能管理圖表 (Performance Management Chart)
export const PMCChart: React.FC<PMCChartProps> = ({ activities, ftp }) => {
    const [showTSS, setShowTSS] = useState(true);
    const [showAll, setShowAll] = useState(true);
    const [displayDays, setDisplayDays] = useState<PeriodOption>(90);
    const [isMobile, setIsMobile] = useState(false);

    // 偵測設備寬度
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const data = useMemo(() => {
        if (!activities || activities.length === 0) return [];

        // 1. 準備基礎數據：將所有活動轉換為每日 TSS Map
        const activityMap = new Map<string, number>();

        // 確保活動按日期排序
        const sortedActivities = [...activities].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

        const startDate = new Date(sortedActivities[0].start_date);
        const today = new Date();
        const endDate = new Date(today);

        // 填充每日 TSS
        sortedActivities.forEach(activity => {
            const dateStr = activity.start_date.split('T')[0];

            let tss = 0;
            if (ftp > 0 && (activity.average_watts || activity.weighted_average_watts)) {
                const np = Number(activity.weighted_average_watts || (activity.average_watts ? activity.average_watts * 1.05 : 0));
                if (np > 0) {
                    const intensity = np / ftp;
                    tss = (activity.moving_time * np * intensity) / (ftp * 3600) * 100;
                }
            }

            const currentTss = activityMap.get(dateStr) || 0;
            activityMap.set(dateStr, currentTss + tss);
        });

        // 2. 計算 PMC (CTL, ATL, TSB)
        const kCTL = 42;
        const kATL = 7;

        const fullData = [];
        let currentCTL = 0;
        let currentATL = 0;

        const iterDate = new Date(startDate);
        iterDate.setHours(0, 0, 0, 0);

        while (iterDate <= endDate) {
            const dateStr = iterDate.toISOString().split('T')[0];
            // 手機版用更短的日期格式
            const displayDate = format(iterDate, isMobile ? 'M/d' : 'MM/dd');
            const tss = activityMap.get(dateStr) || 0;

            // EWMA Calculations
            if (fullData.length === 0) {
                currentCTL = tss / kCTL;
                currentATL = tss / kATL;
            } else {
                currentCTL = currentCTL + (tss - currentCTL) / kCTL;
                currentATL = currentATL + (tss - currentATL) / kATL;
            }

            fullData.push({
                dateStr: displayDate,
                fullDate: dateStr,
                timestamp: iterDate.getTime(),
                tss,
                ctl: Math.round(currentCTL),
                atl: Math.round(currentATL),
                tsb: Math.round(currentCTL - currentATL),
                dayOfWeek: iterDate.getDay(),
            });

            iterDate.setDate(iterDate.getDate() + 1);
        }

        // 根據選擇的週期過濾資料
        const filterDate = new Date(today);
        filterDate.setDate(filterDate.getDate() - displayDays);

        return fullData.filter(d => d.timestamp >= filterDate.getTime());
    }, [activities, ftp, displayDays, isMobile]);

    // 計算 TSS 和 TSB 各自的對稱 Y 軸 domain
    const { tssDomain, tsbDomain } = useMemo(() => {
        if (!data || data.length === 0) return { tssDomain: [-100, 100] as [number, number], tsbDomain: [-50, 50] as [number, number] };
        const maxTss = Math.max(...data.map(d => d.tss || 0), 50);
        const tssDomain: [number, number] = [-maxTss, maxTss];
        const maxTsbAbs = Math.max(...data.map(d => Math.abs(d.tsb || 0)), 30);
        const tsbDomain: [number, number] = [-maxTsbAbs, maxTsbAbs];
        return { tssDomain, tsbDomain };
    }, [data]);

    if (data.length === 0) return null;

    // 取得最新狀態
    const latest = data[data.length - 1] || { ctl: 0, atl: 0, tsb: 0 };

    // 響應式參數
    const chartHeight = isMobile ? 220 : 300;
    const tickInterval = isMobile ? Math.ceil(displayDays / 5) : Math.ceil(displayDays / 10); // 增加密度調整
    const barSize = isMobile ? 4 : 6;
    const strokeWidth = isMobile ? 2 : 3;

    return (
        <div className="bg-slate-800/40 rounded-xl p-3 sm:p-4 border border-slate-700/30">
            {/* 標題區域 - 手機版優化 */}
            <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-4">
                {/* 標題行 */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                            <h3 className="text-sm font-medium text-slate-300">進階體能追蹤</h3>
                            <p className="text-[9px] text-slate-500 mt-0.5 hidden sm:block">
                                追蹤您的長期體能 (Fitness) 與短期疲勞 (Fatigue) 趨勢
                            </p>
                        </div>
                    </div>

                    {/* 資料顯示控制 - 緊湊版 */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowTSS(!showTSS)}
                            className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-medium transition-colors border touch-manipulation ${showTSS
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-slate-800/50 text-slate-500 border-slate-700/50'
                                }`}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            TSS
                        </button>
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-medium transition-colors border touch-manipulation ${showAll
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-slate-800/50 text-slate-500 border-slate-700/50'
                                }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${showAll ? 'bg-indigo-500' : 'bg-slate-500'}`} />
                            {isMobile ? (showAll ? '隱' : '顯') : (showAll ? '隱藏' : '顯示')}
                        </button>
                    </div>
                </div>

                {/* 週期選擇器 - 新增 */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {PERIOD_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            onClick={() => setDisplayDays(option.value)}
                            className={`shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all touch-manipulation ${displayDays === option.value
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* 狀態摘要卡片 - 響應式 */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <div className="bg-slate-900/50 rounded-lg p-1.5 sm:p-2 border border-slate-700/30 text-center">
                        <div className="text-[8px] sm:text-[9px] text-slate-500">體能</div>
                        <div className="text-sm sm:text-lg font-bold text-indigo-400">{latest.ctl}</div>
                        <div className="text-[7px] sm:text-[8px] text-slate-600">CTL</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-1.5 sm:p-2 border border-slate-700/30 text-center">
                        <div className="text-[8px] sm:text-[9px] text-slate-500">疲勞</div>
                        <div className="text-sm sm:text-lg font-bold text-pink-400">{latest.atl}</div>
                        <div className="text-[7px] sm:text-[8px] text-slate-600">ATL</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-1.5 sm:p-2 border border-slate-700/30 text-center">
                        <div className="text-[8px] sm:text-[9px] text-slate-500">狀態</div>
                        <div className={`text-sm sm:text-lg font-bold ${latest.tsb >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                            {latest.tsb > 0 ? '+' : ''}{latest.tsb}
                        </div>
                        <div className="text-[7px] sm:text-[8px] text-slate-600">TSB</div>
                    </div>
                </div>
            </div>

            {/* 圖表區域 - 響應式高度 */}
            <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        margin={{
                            top: 10,
                            right: isMobile ? 5 : 10,
                            left: isMobile ? -25 : -15,
                            bottom: 0
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="dateStr"
                            stroke="#64748b"
                            tick={{ fontSize: isMobile ? 9 : 10 }}
                            tickLine={false}
                            interval={tickInterval}
                            angle={isMobile ? -45 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 35 : 25}
                        />
                        <XAxis
                            xAxisId="tsb_axis"
                            dataKey="dateStr"
                            hide
                        />
                        <YAxis
                            yAxisId="load"
                            stroke="#64748b"
                            tick={{ fontSize: isMobile ? 9 : 10 }}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 'auto']}
                            width={isMobile ? 25 : 35}
                        />
                        <YAxis
                            yAxisId="tsb"
                            orientation="right"
                            stroke="#94a3b8"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            domain={tsbDomain}
                            hide={true}
                        />
                        <YAxis
                            yAxisId="tss"
                            orientation="right"
                            stroke="#10b981"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            domain={tssDomain}
                            hide={true}
                        />

                        {/* 自定義 Tooltip - 手機版優化 */}
                        <Tooltip
                            cursor={{ fill: '#334155', opacity: 0.2 }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900/95 backdrop-blur border border-slate-700 p-2 sm:p-3 rounded-lg shadow-xl text-[10px] sm:text-xs z-50">
                                            <p className="text-slate-400 mb-1.5 font-medium border-b border-slate-700 pb-1">{d.fullDate}</p>
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between gap-3">
                                                    <span className="text-slate-500">體能</span>
                                                    <span className="text-indigo-400 font-medium">{d.ctl}</span>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <span className="text-slate-500">疲勞</span>
                                                    <span className="text-pink-400 font-medium">{d.atl}</span>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <span className="text-slate-500">狀態</span>
                                                    <span className={`font-medium ${d.tsb >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{d.tsb}</span>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                    <span className="text-slate-500">TSS</span>
                                                    <span className="text-red-400 font-medium">{Math.round(d.tss)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* TSB - Bar */}
                        <Bar
                            yAxisId="tsb"
                            xAxisId="tsb_axis"
                            dataKey="tsb"
                            name="狀態 (TSB)"
                            fill="#f97316"
                            barSize={barSize}
                            opacity={0.9}
                            hide={!showAll}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`tsb-${index}`}
                                    fill={entry.tsb >= 0 ? '#10b981' : '#f97316'}
                                />
                            ))}
                        </Bar>

                        {/* ATL - Line */}
                        <Line
                            yAxisId="load"
                            type="monotone"
                            dataKey="atl"
                            name="疲勞 (ATL)"
                            stroke="#f472b6"
                            strokeWidth={strokeWidth}
                            strokeDasharray="4 4"
                            dot={false}
                            activeDot={{ r: isMobile ? 4 : 5, strokeWidth: 2 }}
                            hide={!showAll}
                        />

                        {/* CTL - Area */}
                        <Area
                            yAxisId="load"
                            type="monotone"
                            dataKey="ctl"
                            name="體能 (CTL)"
                            stroke="#818cf8"
                            fill="url(#colorCtlSeparate)"
                            fillOpacity={0.2}
                            strokeWidth={strokeWidth}
                            activeDot={{ r: isMobile ? 4 : 5, strokeWidth: 2 }}
                            hide={!showAll}
                        />
                        <defs>
                            <linearGradient id="colorCtlSeparate" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        {/* TSB 0 軸參考線 */}
                        <ReferenceLine y={0} yAxisId="tsb" stroke="#475569" strokeDasharray="3 3" />

                        {/* TSS - Bar */}
                        <Bar
                            yAxisId="tss"
                            dataKey="tss"
                            name="訓練量 (TSS)"
                            fill="#ef4444"
                            radius={[2, 2, 0, 0]}
                            maxBarSize={isMobile ? 6 : 8}
                            opacity={0.7}
                            hide={!showTSS}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
