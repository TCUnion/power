import { Zap } from 'lucide-react';
import React from 'react';

/**
 * 功率區間分佈組件
 */

interface ZoneDistributionProps {
    zones: {
        name: string;
        min: number;
        max: number;
        color: string;
        label: string;
        value: number;
        pct: number;
        range: string;
        seconds: number;
    }[];
    mmp20m: number;
}

const ZoneDistribution = React.memo(({ zones, mmp20m }: ZoneDistributionProps) => {
    return (
        <div className="md:col-span-12 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Power Zone Distribution
            </h3>
            <div className="flex flex-col gap-4">
                {zones.map((zone) => {
                    const pctNumeric = typeof zone.pct === 'string' ? parseFloat(zone.pct) : zone.pct;
                    return (
                        <div key={zone.name} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-end text-xs">
                                <span className="font-bold text-slate-300">{zone.name}</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400 font-mono">{zone.range}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(zone.seconds * 1000).toISOString().substr(11, 8)} ({zone.pct}%)</span>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-slate-700/50 rounded-full overflow-hidden border border-slate-800/50">
                                <div
                                    className={`h-full ${zone.color} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                                    style={{ width: `${pctNumeric}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                    <span>Power Zones based on MMP 20min ({mmp20m}W)</span>
                    <span className="text-slate-400">Golden Cheetah Standards</span>
                </div>
            </div>
        </div>
    );
});

ZoneDistribution.displayName = 'ZoneDistribution';

export default ZoneDistribution;
