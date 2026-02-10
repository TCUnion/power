import { Activity, Dumbbell, Zap, TrendingUp, Scale, Timer } from 'lucide-react';
import { format } from 'date-fns';
import React from 'react';

/**
 * 績效摘要指標組件
 */

interface MetricCardProps {
    title: string;
    value: number | string;
    unit?: string;
    icon?: React.ElementType;
    color?: string;
    subValue?: string;
}

const MetricCard = React.memo(({ title, value, unit, icon: Icon, color = "text-slate-200", subValue }: MetricCardProps) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center h-full">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
            {Icon && <Icon className={`w-4 h-4 ${color} opacity-80`} />}
        </div>
        <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black ${color}`}>{value}</span>
            {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
        </div>
        {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
));

MetricCard.displayName = 'MetricCard';





export interface ActivitySummary {
    tss: number;
    if: number;
    work: number;
    duration: number;
    np: number;
    avgPower: number;
    maxPower: number;
    avgHR: number;
    maxHR: number;
    mmp20m: number;
    timeAboveCPPct: number;
    timeAboveCP: number;
    vi: number;
    wPrimeWork?: number;
}



interface PerformanceSummaryProps {
    summary: ActivitySummary;
    athleteWeight: number;
}

const PerformanceSummary = React.memo(({ summary, athleteWeight }: PerformanceSummaryProps) => {
    return (
        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <MetricCard
                title="TSS"
                value={summary.tss}
                icon={Activity}
                color="text-yellow-400"
                subValue={`IF: ${(Math.round(summary.if * 100) / 100).toFixed(2)}`}
            />
            <MetricCard
                title="WORK"
                value={summary.work}
                unit="kJ"
                icon={Dumbbell}
                color="text-purple-400"
                subValue={format(new Date(0, 0, 0, 0, 0, summary.duration), 'HH:mm:ss')}
            />
            <MetricCard
                title="MMP 20min"
                value={summary.mmp20m}
                unit="W"
                icon={Timer}
                color="text-orange-400"
                subValue={athleteWeight > 0 ? `${(summary.mmp20m / athleteWeight).toFixed(1)} W/kg` : undefined}
            />

            <MetricCard
                title="NORMALIZED POWER"
                value={summary.np}
                unit="W"
                icon={Zap}
                color="text-emerald-400"
                subValue={`Avg: ${summary.avgPower}W`}
            />
            <MetricCard
                title="TIME ABOVE CP"
                value={`${(summary.timeAboveCPPct || 0).toFixed(1)}%`}
                unit="duration"
                icon={TrendingUp}
                color="text-purple-400"
                subValue={`${Math.round(summary.timeAboveCP / 60)} min`}
            />
            <MetricCard
                title="VI"
                value={summary.vi.toFixed(2)}
                icon={Scale}
                color="text-pink-400"
                subValue="Variability Index"
            />
        </div>
    );
});

PerformanceSummary.displayName = 'PerformanceSummary';

export default PerformanceSummary;
