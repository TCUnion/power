import { useRef, useState, useMemo, useEffect } from 'react';
import { ChevronDown, Search, Info, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import React from 'react';

/**
 * 活動選擇器組件
 * 抽離自 GoldenCheetahPage，負責處理活動列表顯示、搜尋與切換
 */

import type { StravaActivity, StravaStreams } from '../../../types';

interface ActivitySelectorProps {
    latestActivity: StravaActivity;
    allActivities: StravaActivity[];
    allStreamsData: Partial<StravaStreams>[];
    selectedActivityId: number | null;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectActivity: (id: number) => void;
    handleNavigateActivity: (direction: 'prev' | 'next') => void;
    handleSyncActivity: (id: number) => void;
    syncStatus: Record<number, 'idle' | 'syncing' | 'success' | 'error'>;
    hasData: boolean;
}

const ActivitySelector = React.memo(({
    latestActivity,
    allActivities,
    allStreamsData,
    selectedActivityId,
    searchQuery,
    setSearchQuery,
    selectActivity,
    handleNavigateActivity,
    handleSyncActivity,
    syncStatus,
    hasData
}: ActivitySelectorProps) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredActivities = useMemo(() => {
        if (!searchQuery) return allActivities;
        const lower = searchQuery.toLowerCase();
        return allActivities.filter((a) =>
            a.name.toLowerCase().includes(lower)
        );
    }, [allActivities, searchQuery]);

    const findIndex = (id: number | null) => filteredActivities.findIndex((a: StravaActivity) => a.id === id);

    return (
        <div className="flex items-center gap-4 bg-slate-900/50 p-2 pr-4 rounded-xl border border-slate-800/50">
            {/* 活動選擇下拉選單 */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-all border border-slate-700/50 min-w-[280px] sm:min-w-[320px] max-w-[500px]"
                >
                    <div className="flex flex-col items-start truncate flex-1">
                        <span className={`text-sm font-bold truncate w-full ${!hasData ? 'text-slate-400' : 'text-white'}`}>
                            {latestActivity.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                            <span>{format(new Date(latestActivity.start_date), 'yyyy-MM-dd HH:mm')}</span>
                            <span>•</span>
                            <span>{(latestActivity.distance / 1000).toFixed(1)}km</span>
                            {!hasData && (
                                <span className="flex items-center gap-1 text-orange-400 ml-2 bg-orange-500/10 px-1.5 py-0.5 rounded">
                                    <Info className="w-3 h-3" /> 未同步
                                </span>
                            )}
                        </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full sm:w-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[600px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="搜尋活動名稱..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {filteredActivities.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs">
                                    無法找到符合的活動
                                </div>
                            ) : (
                                filteredActivities.map((act) => {
                                    const hasStream = allStreamsData.some((s) => s.activity_id === act.id);
                                    const isSelected = act.id === selectedActivityId;
                                    const currentSyncStatus = syncStatus[act.id];
                                    return (
                                        <button
                                            key={act.id}
                                            onClick={() => {
                                                selectActivity(act.id);
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition cursor-pointer border-b border-slate-800/50 last:border-0 ${isSelected
                                                ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500'
                                                : 'hover:bg-slate-800/60'
                                                }`}
                                        >
                                            <div className="text-xs text-slate-500 font-mono w-[80px] flex-shrink-0">
                                                {format(new Date(act.start_date), 'MM/dd HH:mm')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm truncate ${isSelected ? 'text-yellow-400 font-bold' : 'text-slate-200'}`}>
                                                    {act.name}
                                                </div>
                                                <div className="text-[10px] text-slate-500 flex gap-3 mt-0.5 items-center">
                                                    <span>{(act.distance / 1000).toFixed(1)} km</span>
                                                    <span>{new Date(act.moving_time * 1000).toISOString().substr(11, 8)}</span>
                                                    {!hasStream && (
                                                        <span className="text-orange-400 flex items-center gap-1 ml-auto">
                                                            {currentSyncStatus === 'syncing' ? (
                                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Info className="w-3 h-3" />
                                                            )}
                                                            {currentSyncStatus === 'syncing' ? '同步中' : '無數據'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && !hasStream && currentSyncStatus !== 'syncing' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSyncActivity(act.id);
                                                    }}
                                                    className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"
                                                    title="立即同步"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 快速導航按鈕 */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700/50 hidden sm:flex">
                <button
                    onClick={() => handleNavigateActivity('prev')}
                    disabled={findIndex(selectedActivityId) >= filteredActivities.length - 1}
                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleNavigateActivity('next')}
                    disabled={findIndex(selectedActivityId) <= 0}
                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

ActivitySelector.displayName = 'ActivitySelector';

export default ActivitySelector;
