/**
 * MMP 曲線圖表 (Mean Maximal Power / Power-Duration Curve)
 * 
 * 顯示選手在不同時間長度下的最大平均功率，
 * 並疊加 Morton's 3P CP 模型擬合曲線。
 * 
 * 參考：GoldenCheetah Power-Duration Model, Velozs cycling-analytics
 */

import React, { useMemo, useState } from 'react';
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import { Zap, TrendingUp, Target } from 'lucide-react';

// MMP 採樣時間點 (秒)
const MMP_DURATIONS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1800, 2400, 3600, 5400, 7200];

// 格式化時間 (秒 -> 人可讀)
const formatDurationLabel = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return sec > 0 ? `${min}m${sec}s` : `${min}m`;
    }
    const hr = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    return min > 0 ? `${hr}h${min}m` : `${hr}h`;
};

// Morton's 3-Parameter CP Model: P(t) = CP + W' / (t - τ)
// 使用 Levenberg-Marquardt 簡化近似
const fitMorton3P = (pdCurve: { duration: number; power: number }[]): {
    cp: number;
    wPrime: number;
    tau: number;
    rSquared: number;
    fittedCurve: { duration: number; power: number }[];
} | null => {
    // 需要至少 4 個有效數據點
    const validPoints = pdCurve.filter(p => p.power > 0 && p.duration >= 60);
    if (validPoints.length < 4) return null;

    // 初始估計
    let cp = validPoints[validPoints.length - 1].power; // 最長時間的功率作為 CP 初始值
    let wPrime = 20000; // 20kJ 初始估計
    let tau = 15; // 15s 初始估計

    const maxIterations = 200;
    let lambda = 0.001;

    for (let iter = 0; iter < maxIterations; iter++) {
        // 計算殘差
        let ssr = 0;
        const residuals: number[] = [];
        const jacobian: number[][] = [];

        for (const point of validPoints) {
            const predicted = cp + wPrime / (point.duration - tau);
            const residual = point.power - predicted;
            residuals.push(residual);
            ssr += residual * residual;

            // 偏導數
            const dcp = -1;
            const dwp = -1 / (point.duration - tau);
            const dtau = wPrime / ((point.duration - tau) * (point.duration - tau));
            jacobian.push([dcp, dwp, dtau]);
        }

        // 簡化的 LM 步驟 (梯度下降方向)
        let gradCp = 0, gradWp = 0, gradTau = 0;
        for (let i = 0; i < residuals.length; i++) {
            gradCp += -2 * residuals[i] * jacobian[i][0];
            gradWp += -2 * residuals[i] * jacobian[i][1];
            gradTau += -2 * residuals[i] * jacobian[i][2];
        }

        // 更新參數
        const newCp = cp - lambda * gradCp;
        const newWp = wPrime - lambda * gradWp * 100; // W' 的尺度較大
        const newTau = tau - lambda * gradTau * 0.1;

        // 邊界限制
        cp = Math.max(50, Math.min(500, newCp));
        wPrime = Math.max(1000, Math.min(100000, newWp));
        tau = Math.max(1, Math.min(60, newTau));

        // 收斂判定
        if (Math.abs(gradCp) < 0.01 && Math.abs(gradWp) < 1 && Math.abs(gradTau) < 0.001) {
            break;
        }
    }

    // 計算 R²
    const mean = validPoints.reduce((sum, p) => sum + p.power, 0) / validPoints.length;
    const ssTotal = validPoints.reduce((sum, p) => sum + (p.power - mean) ** 2, 0);
    const ssResidual = validPoints.reduce((sum, p) => {
        const predicted = cp + wPrime / (p.duration - tau);
        return sum + (p.power - predicted) ** 2;
    }, 0);
    const rSquared = Math.max(0, 1 - ssResidual / ssTotal);

    // 生成擬合曲線
    const fittedCurve = MMP_DURATIONS
        .filter(d => d > tau + 1 && d >= 60)
        .map(d => ({
            duration: d,
            power: Math.round(cp + wPrime / (d - tau)),
        }));

    return {
        cp: Math.round(cp),
        wPrime: Math.round(wPrime),
        tau: Math.round(tau * 10) / 10,
        rSquared: Math.round(rSquared * 1000) / 1000,
        fittedCurve,
    };
};

// 計算 MMP (Mean Maximal Power) 曲線
const calculateMMP = (allPowerArrays: number[][]): { duration: number; power: number }[] => {
    const result: { duration: number; power: number }[] = [];

    for (const duration of MMP_DURATIONS) {
        let maxAvg = 0;

        for (const powerData of allPowerArrays) {
            if (powerData.length < duration) continue;

            // 滑動窗口
            let windowSum = 0;
            for (let i = 0; i < duration; i++) {
                windowSum += powerData[i];
            }
            maxAvg = Math.max(maxAvg, windowSum / duration);

            for (let i = duration; i < powerData.length; i++) {
                windowSum += powerData[i] - powerData[i - duration];
                maxAvg = Math.max(maxAvg, windowSum / duration);
            }
        }

        if (maxAvg > 0) {
            result.push({ duration, power: Math.round(maxAvg) });
        }
    }

    return result;
};

// 功率分級 (Coggan Power Profile)
const POWER_PROFILE_DURATIONS = [
    { key: '5s', duration: 5, label: '5 秒', category: '神經肌肉' },
    { key: '1min', duration: 60, label: '1 分鐘', category: '無氧能力' },
    { key: '5min', duration: 300, label: '5 分鐘', category: 'VO2max' },
    { key: '20min', duration: 1200, label: '20 分鐘', category: '乳酸閾值' },
    { key: '60min', duration: 3600, label: '60 分鐘', category: '耐力' },
];

// 根據體重計算功率分級 (W/kg)
const getPowerLevel = (wpk: number, durationKey: string): { level: string; color: string; pct: number } => {
    // 簡化的 Coggan 功率分級表 (男性)
    const thresholds: Record<string, number[]> = {
        '5s': [10.0, 13.0, 16.0, 19.0, 22.0, 25.0],
        '1min': [5.0, 6.5, 8.0, 9.5, 11.0, 12.5],
        '5min': [3.0, 3.8, 4.6, 5.4, 6.2, 7.0],
        '20min': [2.5, 3.2, 3.9, 4.6, 5.3, 6.0],
        '60min': [2.0, 2.7, 3.4, 4.1, 4.8, 5.5],
    };
    const levels = ['未訓練', '初學者', '中級', '進階', '菁英', '世界級'];
    const colors = ['#6B7280', '#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444'];

    const t = thresholds[durationKey] || thresholds['5min'];
    let idx = 0;
    for (let i = t.length - 1; i >= 0; i--) {
        if (wpk >= t[i]) { idx = i; break; }
    }
    const pct = Math.min(100, (wpk / t[t.length - 1]) * 100);
    return { level: levels[idx], color: colors[idx], pct };
};

interface MMPChartProps {
    powerArrays: number[][]; // 多個活動的功率數據陣列
    ftp: number;
    weight?: number; // 體重 (kg)，用於 W/kg 計算
}

export const MMPChart: React.FC<MMPChartProps> = ({ powerArrays, ftp, weight = 70 }) => {
    const [showFitted, setShowFitted] = useState(true);

    // 計算 MMP 曲線
    const mmpCurve = useMemo(() => calculateMMP(powerArrays), [powerArrays]);

    // 擬合 CP 模型
    const cpModel = useMemo(() => fitMorton3P(mmpCurve), [mmpCurve]);

    // 合併數據供圖表使用 (使用對數刻度的 X 軸)
    const chartData = useMemo(() => {
        if (mmpCurve.length === 0) return [];

        const fittedMap = new Map<number, number>();
        if (cpModel?.fittedCurve) {
            cpModel.fittedCurve.forEach(p => fittedMap.set(p.duration, p.power));
        }

        return mmpCurve.map(p => ({
            duration: p.duration,
            durationLabel: formatDurationLabel(p.duration),
            power: p.power,
            fitted: fittedMap.get(p.duration) || null,
            wpk: weight > 0 ? Math.round((p.power / weight) * 100) / 100 : null,
        }));
    }, [mmpCurve, cpModel, weight]);

    // 功率剖面分析
    const powerProfile = useMemo(() => {
        return POWER_PROFILE_DURATIONS.map(pp => {
            const mmpPoint = mmpCurve.find(m => m.duration === pp.duration);
            const power = mmpPoint?.power || 0;
            const wpk = weight > 0 ? Math.round((power / weight) * 100) / 100 : 0;
            const level = getPowerLevel(wpk, pp.key);
            return { ...pp, power, wpk, ...level };
        });
    }, [mmpCurve, weight]);

    if (mmpCurve.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">需要至少一個已同步的活動才能生成 MMP 曲線</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* CP 模型結果 */}
            {cpModel && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl p-4 border border-yellow-500/20">
                        <div className="text-[10px] font-bold text-yellow-500/70 uppercase tracking-widest mb-1">Critical Power</div>
                        <div className="text-2xl font-black text-yellow-400">{cpModel.cp}<span className="text-sm font-bold text-yellow-500/50 ml-1">W</span></div>
                        <div className="text-[10px] text-slate-500 mt-1">
                            {weight > 0 && `${(cpModel.cp / weight).toFixed(2)} W/kg`}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-2xl p-4 border border-red-500/20">
                        <div className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest mb-1">W' (無氧容量)</div>
                        <div className="text-2xl font-black text-red-400">{(cpModel.wPrime / 1000).toFixed(1)}<span className="text-sm font-bold text-red-500/50 ml-1">kJ</span></div>
                        <div className="text-[10px] text-slate-500 mt-1">
                            衝刺耐受極限
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-4 border border-purple-500/20">
                        <div className="text-[10px] font-bold text-purple-500/70 uppercase tracking-widest mb-1">τ (時間常數)</div>
                        <div className="text-2xl font-black text-purple-400">{cpModel.tau}<span className="text-sm font-bold text-purple-500/50 ml-1">s</span></div>
                        <div className="text-[10px] text-slate-500 mt-1">
                            反應延遲修正
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-4 border border-emerald-500/20">
                        <div className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-1">模型擬合度 (R²)</div>
                        <div className="text-2xl font-black text-emerald-400">{cpModel.rSquared.toFixed(3)}</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                            {cpModel.rSquared >= 0.95 ? '極佳' : cpModel.rSquared >= 0.90 ? '良好' : '普通'}
                        </div>
                    </div>
                </div>
            )}

            {/* MMP 曲線圖 */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        功率-時間曲線 (Power-Duration Curve)
                    </h4>
                    {cpModel && (
                        <button
                            onClick={() => setShowFitted(!showFitted)}
                            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${showFitted
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                                }`}
                        >
                            {showFitted ? 'CP 模型 ON' : 'CP 模型 OFF'}
                        </button>
                    )}
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                            <defs>
                                <linearGradient id="mmpGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                            <XAxis
                                dataKey="durationLabel"
                                stroke="#94a3b8"
                                tick={{ fontSize: 10, fontWeight: 600 }}
                                interval="preserveStartEnd"
                                minTickGap={40}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tick={{ fontSize: 10 }}
                                domain={[0, 'auto']}
                                tickFormatter={(v) => `${v}W`}
                            />
                            {/* FTP 參考線 */}
                            {ftp > 0 && (
                                <ReferenceLine
                                    y={ftp}
                                    stroke="#3B82F6"
                                    strokeDasharray="5 5"
                                    strokeWidth={1.5}
                                    label={{ value: `FTP ${ftp}W`, position: 'right', fill: '#3B82F6', fontSize: 10, fontWeight: 700 }}
                                />
                            )}
                            {/* CP 參考線 */}
                            {cpModel && (
                                <ReferenceLine
                                    y={cpModel.cp}
                                    stroke="#FBBF24"
                                    strokeDasharray="3 3"
                                    strokeWidth={1}
                                    label={{ value: `CP ${cpModel.cp}W`, position: 'left', fill: '#FBBF24', fontSize: 10, fontWeight: 700 }}
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
                                formatter={(value: any, name: string) => {
                                    if (name === 'power') return [`${value} W`, '實際最大功率'];
                                    if (name === 'fitted') return [`${value} W`, 'CP 模型預測'];
                                    return [value, name];
                                }}
                            />
                            {/* 實際 MMP 曲線 */}
                            <Area
                                type="monotone"
                                dataKey="power"
                                stroke="#EAB308"
                                strokeWidth={2.5}
                                fill="url(#mmpGradient)"
                                dot={{ r: 3, fill: '#EAB308', strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: '#EAB308', stroke: '#fff', strokeWidth: 2 }}
                            />
                            {/* CP 模型擬合曲線 */}
                            {showFitted && (
                                <Line
                                    type="monotone"
                                    dataKey="fitted"
                                    stroke="#34D399"
                                    strokeWidth={2}
                                    strokeDasharray="6 3"
                                    dot={false}
                                    connectNulls
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 功率剖面卡片 */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4" />
                    功率剖面 (Power Profile)
                </h4>
                <div className="space-y-3">
                    {powerProfile.map(pp => (
                        <div key={pp.key} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-300 w-16">{pp.label}</span>
                                    <span className="text-[10px] font-medium text-slate-500">{pp.category}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-white">{pp.power}<span className="text-slate-500 text-[10px] ml-0.5">W</span></span>
                                    {pp.wpk > 0 && (
                                        <span className="text-xs font-bold text-slate-400">{pp.wpk}<span className="text-slate-600 text-[10px] ml-0.5">W/kg</span></span>
                                    )}
                                    <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: `${pp.color}20`, color: pp.color }}
                                    >
                                        {pp.level}
                                    </span>
                                </div>
                            </div>
                            {/* 進度條 */}
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${Math.min(100, pp.pct)}%`,
                                        background: `linear-gradient(90deg, ${pp.color}80, ${pp.color})`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                {weight > 0 && (
                    <p className="text-[10px] text-slate-600 mt-3">
                        * 分級標準基於 Coggan Power Profile (男性)，體重 {weight}kg 計算
                    </p>
                )}
            </div>
        </div>
    );
};
