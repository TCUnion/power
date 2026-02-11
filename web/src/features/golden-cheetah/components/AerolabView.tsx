/**
 * AerolabView — Aerolab 虛擬海拔分析主頁面
 * 
 * 透過 Virtual Elevation (Chung Method) 分析騎乘數據，
 * 讓使用者互動調整 CdA/Crr 參數，觀察虛擬海拔與實際海拔的吻合程度。
 * 
 * 靈感來源：GoldenCheetah Aerolab (GPL v2)
 */
import { useState, useMemo, useCallback } from 'react';
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
    ReferenceLine,
} from 'recharts';
import {
    Wind,
    Target,
    Sliders,
    RotateCcw,
    Zap,
    AlertTriangle,
    Thermometer,
    Gauge,
    Mountain,
    Info,
} from 'lucide-react';
import {
    calculateVirtualElevation,
    calculateAirDensity,
    autoFitCdA,
    validateAerolabStreams,
    DEFAULT_AEROLAB_PARAMS,
} from '../../../utils/aerolab';
import type { AerolabParams, AerolabStreams } from '../../../utils/aerolab';

// ============================================
// Props
// ============================================

interface AerolabViewProps {
    /** 功率串流 (W) */
    powerStream: number[];
    /** 速度串流 (m/s) */
    velocityStream: number[];
    /** 海拔串流 (m) */
    altitudeStream: number[];
    /** 距離串流 (m) */
    distanceStream: number[];
    /** 騎手體重 (kg) */
    athleteWeight: number;
    /** 溫度串流 (°C)，用於空氣密度計算 */
    tempStream?: number[];
}

// ============================================
// 常數：滑桿設定
// ============================================

const SLIDER_CONFIG = {
    cda: { min: 0.15, max: 0.50, step: 0.001, label: 'CdA', unit: 'm²' },
    crr: { min: 0.001, max: 0.010, step: 0.0001, label: 'Crr', unit: '' },
    totalMass: { min: 40, max: 150, step: 0.5, label: '總重', unit: 'kg' },
    airDensity: { min: 0.900, max: 1.400, step: 0.001, label: '空氣密度 ρ', unit: 'kg/m³' },
};

// CdA 參考值（顯示在滑桿上方作為參考）
const CDA_REFERENCES = [
    { label: 'TT 計時車', value: 0.21 },
    { label: '空力車下把', value: 0.27 },
    { label: '公路車下把', value: 0.32 },
    { label: '公路車握把', value: 0.36 },
    { label: '直立騎乘', value: 0.42 },
];

// ============================================
// 元件
// ============================================

export default function AerolabView({
    powerStream,
    velocityStream,
    altitudeStream,
    distanceStream,
    athleteWeight,
    tempStream,
}: AerolabViewProps) {
    // 預設自行車重量 8kg
    const DEFAULT_BIKE_WEIGHT = 8;

    // 參數 state
    const [params, setParams] = useState<AerolabParams>(() => ({
        ...DEFAULT_AEROLAB_PARAMS,
        totalMass: athleteWeight + DEFAULT_BIKE_WEIGHT,
    }));

    const [isAutoFitting, setIsAutoFitting] = useState(false);

    // 組合串流數據
    const streams: AerolabStreams = useMemo(() => ({
        power: powerStream,
        velocity: velocityStream,
        altitude: altitudeStream,
        distance: distanceStream,
    }), [powerStream, velocityStream, altitudeStream, distanceStream]);

    // 驗證數據
    const validationError = useMemo(
        () => validateAerolabStreams(streams),
        [streams]
    );

    // 自動偵測空氣密度（若有溫度數據）
    const detectedAirDensity = useMemo(() => {
        if (!tempStream || tempStream.length === 0) return null;
        const avgTemp = tempStream.reduce((a, b) => a + b, 0) / tempStream.length;
        // 假設標準氣壓，露點 = 氣溫 - 10°C（乾燥條件）
        return calculateAirDensity(avgTemp, 1013.25, avgTemp - 10);
    }, [tempStream]);

    // 計算虛擬海拔（核心計算，以 useMemo 快取）
    const result = useMemo(() => {
        if (validationError) return null;
        return calculateVirtualElevation(streams, params);
    }, [streams, params, validationError]);

    // 更新單一參數
    const updateParam = useCallback((key: keyof AerolabParams, value: number) => {
        setParams(prev => ({ ...prev, [key]: value }));
    }, []);

    // 重設所有參數
    const resetParams = useCallback(() => {
        setParams({
            ...DEFAULT_AEROLAB_PARAMS,
            totalMass: athleteWeight + DEFAULT_BIKE_WEIGHT,
        });
    }, [athleteWeight]);

    // 自動擬合 CdA
    const handleAutoFit = useCallback(() => {
        if (validationError) return;
        setIsAutoFitting(true);

        // 使用 requestAnimationFrame 避免阻塞 UI
        requestAnimationFrame(() => {
            const fitResult = autoFitCdA(streams, params);
            setParams(prev => ({
                ...prev,
                cda: fitResult.cda,
            }));
            setIsAutoFitting(false);
        });
    }, [streams, params, validationError]);

    // 使用偵測到的空氣密度
    const applyDetectedDensity = useCallback(() => {
        if (detectedAirDensity) {
            updateParam('airDensity', detectedAirDensity);
        }
    }, [detectedAirDensity, updateParam]);

    // ============================================
    // 數據不足時顯示提示
    // ============================================
    if (validationError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                <div className="bg-slate-800 p-8 rounded-2xl text-center border border-slate-700 max-w-md">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">無法進行 Aerolab 分析</h3>
                    <p className="text-sm text-slate-400 mb-4">{validationError}</p>
                    <div className="bg-slate-900/50 rounded-lg p-3 text-left">
                        <p className="text-xs text-slate-500 font-bold mb-2">Aerolab 需要以下數據串流：</p>
                        <ul className="text-xs text-slate-500 space-y-1">
                            <li className={powerStream.length > 0 ? 'text-green-400' : 'text-red-400'}>
                                {powerStream.length > 0 ? '✓' : '✗'} 功率 (watts)
                            </li>
                            <li className={velocityStream.length > 0 ? 'text-green-400' : 'text-red-400'}>
                                {velocityStream.length > 0 ? '✓' : '✗'} 速度 (velocity)
                            </li>
                            <li className={altitudeStream.length > 0 ? 'text-green-400' : 'text-red-400'}>
                                {altitudeStream.length > 0 ? '✓' : '✗'} 海拔 (altitude)
                            </li>
                            <li className={distanceStream.length > 0 ? 'text-green-400' : 'text-red-400'}>
                                {distanceStream.length > 0 ? '✓' : '✗'} 距離 (distance)
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // 主渲染
    // ============================================

    // 計算空氣阻力功率佔比（供摘要卡片）
    const avgSpeed = velocityStream.length > 0
        ? velocityStream.reduce((a, b) => a + b, 0) / velocityStream.length
        : 0;
    const avgPowerAero = 0.5 * params.airDensity * params.cda * Math.pow(avgSpeed, 3);
    const avgPower = powerStream.length > 0
        ? powerStream.reduce((a, b) => a + b, 0) / powerStream.length
        : 1;
    const aeroPowerPct = avgPower > 0 ? Math.round((avgPowerAero / avgPower) * 100) : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 標題列 */}
            <div className="lg:col-span-12 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    Aerolab — Virtual Elevation Analysis
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetParams}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重設
                    </button>
                    <button
                        onClick={handleAutoFit}
                        disabled={isAutoFitting}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isAutoFitting
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 active:scale-95'
                            }`}
                    >
                        <Target className={`w-3.5 h-3.5 ${isAutoFitting ? 'animate-spin' : ''}`} />
                        {isAutoFitting ? '擬合中...' : '自動擬合 CdA'}
                    </button>
                </div>
            </div>

            {/* 主圖表 */}
            <div className="lg:col-span-12 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="h-[350px] md:h-[420px]">
                    {result && result.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={result.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis
                                    dataKey="distanceKm"
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: '距離 (km)', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#64748b' }}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fontSize: 10 }}
                                    label={{ value: '海拔 (m)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#64748b' }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#334155',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                    }}
                                    formatter={(value: number, name: string) => {
                                        switch (name) {
                                            case 'actualElev': return [`${value} m`, '實際海拔'];
                                            case 'virtualElev': return [`${value} m`, '虛擬海拔'];
                                            case 'residual': return [`${value} m`, '殘差'];
                                            default: return [value, name];
                                        }
                                    }}
                                    labelFormatter={(label: number) => `${label} km`}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={28}
                                    formatter={(value: string) => {
                                        switch (value) {
                                            case 'actualElev': return '實際海拔';
                                            case 'virtualElev': return '虛擬海拔';
                                            default: return value;
                                        }
                                    }}
                                />
                                {/* 實際海拔 — 藍色填充 */}
                                <Area
                                    type="monotone"
                                    dataKey="actualElev"
                                    stroke="#3b82f6"
                                    fill="#3b82f6"
                                    fillOpacity={0.15}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={false}
                                />
                                {/* 虛擬海拔 — 黃色曲線 */}
                                <Line
                                    type="monotone"
                                    dataKey="virtualElev"
                                    stroke="#eab308"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#eab308' }}
                                />
                                {/* 零線參考 */}
                                <ReferenceLine y={result.actualElevation[0]} stroke="#475569" strokeDasharray="5 5" strokeWidth={0.5} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <p>計算中...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 控制面板 */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5" />
                    參數控制
                </h3>

                {/* CdA 滑桿 + 參考值 */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-400 font-bold">
                            {SLIDER_CONFIG.cda.label}
                        </label>
                        <span className="text-sm font-mono font-bold text-yellow-400">
                            {params.cda.toFixed(3)} {SLIDER_CONFIG.cda.unit}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={SLIDER_CONFIG.cda.min}
                        max={SLIDER_CONFIG.cda.max}
                        step={SLIDER_CONFIG.cda.step}
                        value={params.cda}
                        onChange={e => updateParam('cda', parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    {/* CdA 參考刻度 */}
                    <div className="flex justify-between mt-1 px-0.5">
                        {CDA_REFERENCES.map(ref => (
                            <button
                                key={ref.label}
                                onClick={() => updateParam('cda', ref.value)}
                                className="text-[9px] text-slate-500 hover:text-yellow-400 transition-colors cursor-pointer text-center leading-tight"
                                title={`${ref.label}: ${ref.value}`}
                            >
                                <span className="block">{ref.value}</span>
                                <span className="block text-[8px] opacity-70">{ref.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Crr 滑桿 */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-400 font-bold">
                            {SLIDER_CONFIG.crr.label} (滾動阻力)
                        </label>
                        <span className="text-sm font-mono font-bold text-green-400">
                            {params.crr.toFixed(4)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={SLIDER_CONFIG.crr.min}
                        max={SLIDER_CONFIG.crr.max}
                        step={SLIDER_CONFIG.crr.step}
                        value={params.crr}
                        onChange={e => updateParam('crr', parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                        <span>0.001 (光滑賽場)</span>
                        <span>0.010 (粗糙路面)</span>
                    </div>
                </div>

                {/* 總重滑桿 */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-400 font-bold">
                            {SLIDER_CONFIG.totalMass.label} (人+車)
                        </label>
                        <span className="text-sm font-mono font-bold text-blue-400">
                            {params.totalMass.toFixed(1)} {SLIDER_CONFIG.totalMass.unit}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={SLIDER_CONFIG.totalMass.min}
                        max={SLIDER_CONFIG.totalMass.max}
                        step={SLIDER_CONFIG.totalMass.step}
                        value={params.totalMass}
                        onChange={e => updateParam('totalMass', parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                        <span>40 kg</span>
                        <span>騎手 {athleteWeight}kg + 車 {(params.totalMass - athleteWeight).toFixed(1)}kg</span>
                        <span>150 kg</span>
                    </div>
                </div>

                {/* 空氣密度滑桿 */}
                <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                            {SLIDER_CONFIG.airDensity.label}
                            {detectedAirDensity && (
                                <button
                                    onClick={applyDetectedDensity}
                                    className="text-[10px] text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded hover:bg-cyan-400/10 transition-colors"
                                    title={`根據平均溫度偵測到的空氣密度：${detectedAirDensity}`}
                                >
                                    <Thermometer className="w-2.5 h-2.5 inline mr-0.5" />
                                    使用偵測值 {detectedAirDensity}
                                </button>
                            )}
                        </label>
                        <span className="text-sm font-mono font-bold text-purple-400">
                            {params.airDensity.toFixed(3)} {SLIDER_CONFIG.airDensity.unit}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={SLIDER_CONFIG.airDensity.min}
                        max={SLIDER_CONFIG.airDensity.max}
                        step={SLIDER_CONFIG.airDensity.step}
                        value={params.airDensity}
                        onChange={e => updateParam('airDensity', parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                        <span>0.900 (高海拔/高溫)</span>
                        <span>1.226 (標準)</span>
                        <span>1.400 (低溫/高壓)</span>
                    </div>
                </div>
            </div>

            {/* 結果摘要 */}
            <div className="lg:col-span-4 space-y-4">
                {/* RMSE 指標 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        擬合品質
                    </h3>
                    <div className="text-center py-2">
                        <div className="text-4xl font-black text-white mb-1">
                            {result ? result.rmse : '—'}
                            <span className="text-lg text-slate-500 ml-1">m</span>
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">RMSE (均方根誤差)</div>
                        {result && (
                            <div className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded inline-block ${result.rmse < 3
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : result.rmse < 8
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {result.rmse < 3 ? '✓ 優秀擬合' : result.rmse < 8 ? '△ 可接受' : '✗ 需要調整'}
                            </div>
                        )}
                    </div>
                </div>

                {/* 結果數據 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-yellow-400" />
                        分析結果
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center p-2 bg-white/5 dark:bg-black/20 rounded-lg">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Wind className="w-3 h-3" /> CdA
                            </span>
                            <span className="font-mono font-bold text-yellow-400">{params.cda.toFixed(3)} m²</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/5 dark:bg-black/20 rounded-lg">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Zap className="w-3 h-3" /> Crr
                            </span>
                            <span className="font-mono font-bold text-green-400">{params.crr.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/5 dark:bg-black/20 rounded-lg">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Mountain className="w-3 h-3" /> 空氣阻力佔比
                            </span>
                            <span className="font-mono font-bold text-cyan-400">{aeroPowerPct}%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/5 dark:bg-black/20 rounded-lg">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Zap className="w-3 h-3" /> 平均空阻功率
                            </span>
                            <span className="font-mono font-bold text-orange-400">{Math.round(avgPowerAero)} W</span>
                        </div>
                    </div>
                </div>

                {/* 使用說明 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        使用說明
                    </h3>
                    <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                        <p>
                            調整 <strong className="text-yellow-400">CdA</strong> 和 <strong className="text-green-400">Crr</strong> 滑桿，
                            使 <strong className="text-yellow-400">黃色虛擬海拔</strong> 曲線盡可能吻合
                            <strong className="text-blue-400">藍色實際海拔</strong>。
                        </p>
                        <p>
                            當兩條曲線吻合時，表示 CdA 和 Crr 的估算值接近真實值。
                            RMSE &lt; 3m 為優秀擬合。
                        </p>
                        <p className="text-slate-500">
                            💡 提示：建議選擇風小、地形變化大的路線進行分析，結果較為準確。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
