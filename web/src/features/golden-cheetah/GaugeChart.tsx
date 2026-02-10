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
}) => {
    const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    // NOTE: 使用 270° 圓弧（圓周的 75%），底部開口樣式
    const arcLength = circumference * 0.75;
    const filledLength = arcLength * pct;
    const displayValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 120 90" width={140} height={105}>
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
                    <text y={-2} textAnchor="middle" fill="white" fontSize={18} fontWeight="bold" fontFamily="monospace">
                        {displayValue}
                    </text>
                    <text y={13} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                        {unit}
                    </text>
                    {subLabel && (
                        <text y={26} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
                            {subLabel}
                        </text>
                    )}
                </g>
                {/* 最小值 / 最大值標籤 */}
                <text x={14} y={86} textAnchor="middle" fill="#475569" fontSize={8}>{min}</text>
                <text x={106} y={86} textAnchor="middle" fill="#475569" fontSize={8}>{max}</text>
            </svg>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold -mt-1">{label}</div>
        </div>
    );
};
