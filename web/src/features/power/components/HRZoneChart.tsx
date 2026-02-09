import React from 'react';
import { formatDuration } from '../../../utils/formatters';
import type { HRZoneAnalysis } from '../../../types';

export const HRZoneChart: React.FC<{ zones: HRZoneAnalysis[] }> = ({ zones }) => {
    const maxPercentage = Math.max(...zones.map(z => z.percentageTime), 1);

    return (
        <div className="space-y-2">
            {zones.map(zone => (
                <div key={zone.zone} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-400 truncate">
                        Z{zone.zone} {zone.name}
                    </div>
                    <div className="flex-1 h-5 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(zone.percentageTime / maxPercentage) * 100}%`,
                                backgroundColor: zone.color,
                            }}
                        />
                    </div>
                    <div className="w-14 text-right text-xs font-mono text-slate-300">
                        {zone.percentageTime}%
                    </div>
                    <div className="w-20 text-right text-xs font-mono text-slate-500">
                        {formatDuration(zone.timeInZone)}
                    </div>
                </div>
            ))}
        </div>
    );
};
