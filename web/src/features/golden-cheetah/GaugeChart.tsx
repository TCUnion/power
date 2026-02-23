/**
 * GaugeChart - 圓弧儀表盤元件
 *
 * 模擬 Golden Cheetah 的 CP Estimate / W' Estimate / Weight 等圓弧指標。
 * 使用 SVG stroke-dasharray 技術繪製 270° 圓弧。
 */
import React from 'react';

interface GaugeChartProps {
    /** 目前數值 */
    value: number;
    /** 最小刻度 */
    min: number;
    /** 最大刻度 */
    max: number;
    /** 標題文字 */
    label: string;
    /** 單位文字 */
    unit: string;
    /** 圓弧顏色 */
    color?: string;
    /** 顯示小數位數 */
    decimals?: number;
    /** 副標籤（如 W/kg） */
    subLabel?: string;
    /** 是否可編輯 */
    editable?: boolean;
    /** 當使用者儲存新數值時的回呼 */
    onSave?: (newValue: number) => void;
    /** 預設顯示的自動計算數值 (若有手動覆寫則在外部控制) */
    autoValue?: number;
    /** 讓外部通知是否目前是手動覆寫狀態 */
    isManualOverride?: boolean;
    /** 讓使用者清除手動設定的回呼 */
    onResetAuto?: () => void;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
    value,
    min,
    max,
    label,
    unit,
    color = '#EAB308',
    decimals = 0,
    subLabel,
    editable = false,
    onSave,
    isManualOverride = false,
    onResetAuto,
}) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [tempValue, setTempValue] = React.useState(value.toString());
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setTempValue(value.toString());
    }, [value]);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const num = parseFloat(tempValue);
        if (!isNaN(num) && num > 0) {
            onSave?.(num);
            setIsEditing(false);
        } else {
            // Invalid input, reset to current value
            setTempValue(value.toString());
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setTempValue(value.toString());
            setIsEditing(false);
        }
    };
    const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    // NOTE: 使用 270° 圓弧（圓周的 75%），底部開口樣式
    const arcLength = circumference * 0.75;
    const filledLength = arcLength * pct;
    const displayValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

    return (
        <div className="flex flex-col items-center relative">
            <svg viewBox="0 0 120 90" width={140} height={105} className={isEditing ? 'opacity-20' : ''}>
                <g transform="translate(60, 50)">
                    {/* 旋轉 135° 讓圓弧起點在左下方 (7:30 位置) */}
                    <g transform="rotate(135)">
                        {/* 背景圓弧 */}
                        <circle
                            r={radius}
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth={8}
                            strokeDasharray={`${arcLength} ${circumference}`}
                            strokeLinecap="round"
                        />
                        {/* 數值圓弧 */}
                        {pct > 0 && (
                            <circle
                                r={radius}
                                fill="none"
                                stroke={color}
                                strokeWidth={8}
                                strokeDasharray={`${filledLength} ${circumference}`}
                                strokeLinecap="round"
                                style={{
                                    filter: `drop-shadow(0 0 4px ${color}40)`,
                                    transition: 'stroke-dasharray 0.8s ease-out',
                                }}
                            />
                        )}
                    </g>
                    {/* 數值文字 */}
                    {!isEditing ? (
                        <>
                            <text y={-2} textAnchor="middle" fill="white" fontSize={18} fontWeight="bold" fontFamily="monospace">
                                {displayValue}
                            </text>
                            <text y={13} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                                {unit}
                            </text>
                        </>
                    ) : null}

                    {subLabel && !isEditing && (
                        <text y={26} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
                            {subLabel}
                        </text>
                    )}
                </g>
                {/* 最小值 / 最大值標籤 */}
                <text x={14} y={86} textAnchor="middle" fill="#475569" fontSize={8}>{min}</text>
                <text x={106} y={86} textAnchor="middle" fill="#475569" fontSize={8}>{max}</text>
            </svg>

            {isEditing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-xl z-10 backdrop-blur-sm">
                    <input
                        ref={inputRef}
                        type="number"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-16 h-8 bg-slate-800 text-white text-center font-monospace font-bold rounded border border-slate-600 focus:border-yellow-500 focus:outline-none mb-2"
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/40 rounded transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button onClick={() => { setIsEditing(false); setTempValue(value.toString()); }} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold -mt-1 flex items-center justify-center gap-1 group relative h-6 w-full">
                <span>{label}</span>
                {editable && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-white bg-slate-800/80 rounded absolute -right-2 transform translate-x-full"
                        title="手動編輯數值"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                )}
            </div>

            {editable && (
                <div className="h-4 mt-1 flex items-center justify-center">
                    {isManualOverride ? (
                        <button
                            onClick={onResetAuto}
                            className="text-[9px] px-2 py-0.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-full transition-colors flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                            手動覆寫 (點擊還原)
                        </button>
                    ) : (
                        <span className="text-[9px] text-slate-600 px-2 py-0.5 border border-slate-700/50 rounded-full">
                            自動推算
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
