import type { StravaZoneBucket } from '../../../types';


// Strava 原始區間圖表
export const StravaZoneChart: React.FC<{ data: StravaZoneBucket[], type: 'power' | 'heartrate' }> = ({ data, type }) => {
    if (!data || data.length === 0) return null;

    const totalTime = data.reduce((acc, curr) => acc + (curr.time || 0), 0);

    // Helper to get color
    const getZoneColor = (index: number, isHr: boolean) => {
        const colors = isHr
            ? ['#94a3b8', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444']
            : ['#94a3b8', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7'];
        return colors[index] || '#cbd5e1';
    };

    // Helper format duration
    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div className="space-y-2">
            {data.map((bucket: StravaZoneBucket, index: number) => {
                const time = bucket.time || 0;
                const percentage = totalTime > 0 ? (time / totalTime) * 100 : 0;
                const color = getZoneColor(index, type === 'heartrate');
                const label = bucket.max === -1 ? `> ${bucket.min}` : `${bucket.min} - ${bucket.max}`;

                return (
                    <div key={index} className="flex items-center text-xs">
                        <div className="w-20 text-slate-400 text-right pr-2 truncate">
                            {type === 'heartrate' ? 'Z' + (index + 1) : 'Z' + (index + 1)} ({label})
                        </div>
                        <div className="flex-1 h-6 bg-slate-700/50 rounded-md overflow-hidden relative group">
                            <div
                                className="h-full transition-all duration-500 rounded-md"
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: color
                                }}
                            />
                            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white drop-shadow-md font-medium">{formatDuration(bucket.time || 0)}</span>
                                <span className="text-white drop-shadow-md font-medium">{percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="w-12 text-slate-300 text-right pl-2 font-mono">
                            {percentage.toFixed(1)}%
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
