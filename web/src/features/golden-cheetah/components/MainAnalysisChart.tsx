import { Zap, RefreshCw, CheckCircle } from 'lucide-react';
import {
    Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts';
import React from 'react';

/**
 * 功率與 W' 平衡分析圖表組件
 */

interface MainAnalysisChartProps {
    hasData: boolean;
    currentSyncStatus: 'idle' | 'syncing' | 'success' | 'error' | string;
    handleSyncActivity: (id: number) => void;
    selectedActivityId: number | null;
    chartVisibility: {
        power: boolean;
        wBal: boolean;
        hr: boolean;
        altitude: boolean;
        cadence: boolean;
    };
    toggleSeries: (key: 'power' | 'wBal' | 'hr' | 'altitude' | 'cadence') => void;
    chartData: {
        timeLabel: string;
        power: number;
        wBal: number;
        hr: number | null;
        altitude: number | null;
        cadence: number | null;
    }[];
    calculatedCP: number;
    calculatedWPrime: number;
    hrStream: number[];
    altitudeStream: number[];
    cadenceStream: number[];
}

const MainAnalysisChart = React.memo(({
    hasData,
    currentSyncStatus,
    handleSyncActivity,
    selectedActivityId,
    chartVisibility,
    toggleSeries,
    chartData,
    calculatedCP,
    calculatedWPrime,
    hrStream,
    altitudeStream,
    cadenceStream
}: MainAnalysisChartProps) => {
    return (
        <div className="md:col-span-12 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 min-h-[400px] flex flex-col relative overflow-hidden">

            {/* 同步遮罩 */}
            {!hasData && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 text-center animate-in fade-in duration-500">
                    <div className="bg-slate-800 p-5 rounded-full mb-4 shadow-xl border border-slate-700 relative">
                        <RefreshCw className={`w-10 h-10 text-blue-500 ${currentSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        {currentSyncStatus === 'success' && <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full"><CheckCircle className="w-4 h-4" /></div>}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {currentSyncStatus === 'syncing' ? '正在同步數據...' : '需要同步資料'}
                    </h3>
                    <p className="text-slate-200 mb-6 text-sm max-w-sm">
                        {currentSyncStatus === 'syncing'
                            ? '正在抓取功率與心率數據，請稍候...'
                            : '此活動尚未有詳細串流數據，無法進行功率分析。'
                        }
                    </p>

                    {currentSyncStatus === 'idle' || currentSyncStatus === 'error' ? (
                        <button
                            onClick={() => selectedActivityId && handleSyncActivity(selectedActivityId)}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            立即同步
                        </button>
                    ) : (
                        <div className="px-6 py-2.5 bg-slate-800 text-slate-400 font-bold rounded-lg cursor-not-allowed flex items-center gap-2 text-sm border border-slate-700">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            同步中...
                        </div>
                    )}
                </div>
            )}

            {/* 圖表控制項 */}
            <div className={`flex justify-between items-center mb-4 transition-all duration-500 ${!hasData ? 'opacity-10 blur-[2px]' : ''}`}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Power & W' Balance
                </h3>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                    <button onClick={() => toggleSeries('power')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.power ? 'bg-yellow-500/10 hover:bg-yellow-500/20' : 'opacity-30 hover:opacity-50'}`}>
                        <span className="w-3 h-3 bg-yellow-500/50 rounded-sm"></span>
                        Power
                    </button>
                    <button onClick={() => toggleSeries('wBal')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.wBal ? 'bg-purple-500/10 hover:bg-purple-500/20' : 'opacity-30 hover:opacity-50'}`}>
                        <span className="w-3 h-0.5 bg-purple-500"></span>
                        W' Bal
                    </button>
                    {hrStream && hrStream.length > 0 && (
                        <button onClick={() => toggleSeries('hr')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.hr ? 'bg-red-400/10 hover:bg-red-400/20' : 'opacity-30 hover:opacity-50'}`}>
                            <span className="w-3 h-0.5 bg-red-400"></span>
                            HR
                        </button>
                    )}
                    {altitudeStream && altitudeStream.length > 0 && (
                        <button onClick={() => toggleSeries('altitude')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.altitude ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'opacity-30 hover:opacity-50'}`}>
                            <span className="w-3 h-3 bg-emerald-500/30 rounded-sm"></span>
                            Alt
                        </button>
                    )}
                    {cadenceStream && cadenceStream.length > 0 && (
                        <button onClick={() => toggleSeries('cadence')} className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${chartVisibility.cadence ? 'bg-cyan-400/10 hover:bg-cyan-400/20' : 'opacity-30 hover:opacity-50'}`}>
                            <span className="w-3 h-0.5 bg-cyan-400"></span>
                            Cad
                        </button>
                    )}
                </div>
            </div>

            <div className={`flex-1 w-full min-h-[350px] transition-all duration-500 ${!hasData ? 'opacity-10 blur-[2px] pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#EAB308" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                        <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={50} />
                        <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                        <YAxis yAxisId="right" orientation="right" stroke="#a855f7" tick={{ fontSize: 10 }} domain={[0, Math.ceil(calculatedWPrime / 1000)]} />
                        <YAxis yAxisId="hr" orientation="right" hide domain={[60, 220]} />
                        <YAxis yAxisId="altitude" orientation="right" hide domain={['dataMin - 50', 'dataMax + 50']} />
                        <YAxis yAxisId="cadence" orientation="right" hide domain={[0, 150]} />

                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'power' && chartVisibility.power) return [`${value} W`, 'Power'];
                                if (name === 'wBal' && chartVisibility.wBal) return [`${value} kJ`, "W' Bal"];
                                if (name === 'hr' && chartVisibility.hr) return [`${value} bpm`, 'Heart Rate'];
                                if (name === 'altitude' && chartVisibility.altitude) return [`${value} m`, 'Altitude'];
                                if (name === 'cadence' && chartVisibility.cadence) return [`${value} rpm`, 'Cadence'];
                                return ['', ''];
                            }}
                            labelStyle={{ color: '#94a3b8' }}
                        />

                        <ReferenceLine yAxisId="left" y={calculatedCP} stroke="#EF4444" strokeDasharray="3 3" opacity={0.5} label={{ value: 'CP', fill: '#EF4444', fontSize: 10, position: 'insideLeft' }} />

                        {chartVisibility.altitude && altitudeStream && altitudeStream.length > 0 && (
                            <Area yAxisId="altitude" type="monotone" dataKey="altitude" stroke="#10B981" fill="url(#altitudeGradient)" strokeWidth={1} isAnimationActive={false} opacity={0.6} />
                        )}
                        {chartVisibility.power && (
                            <Area yAxisId="left" type="monotone" dataKey="power" stroke="#EAB308" fill="url(#powerGradient)" strokeWidth={1} isAnimationActive={false} />
                        )}
                        {chartVisibility.wBal && (
                            <Line yAxisId="right" type="monotone" dataKey="wBal" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} />
                        )}
                        {chartVisibility.hr && hrStream && hrStream.length > 0 && (
                            <Line yAxisId="hr" type="monotone" dataKey="hr" stroke="#F87171" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.4} />
                        )}
                        {chartVisibility.cadence && cadenceStream && cadenceStream.length > 0 && (
                            <Line yAxisId="cadence" type="monotone" dataKey="cadence" stroke="#22D3EE" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.5} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
});

MainAnalysisChart.displayName = 'MainAnalysisChart';

export default MainAnalysisChart;
