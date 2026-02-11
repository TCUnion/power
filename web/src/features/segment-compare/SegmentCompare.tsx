import { useState, useEffect } from 'react';
import { ArrowLeftRight, Check, Loader2 } from 'lucide-react';
import type { Segment } from './hooks/useSegmentCompare';
import { useSegmentCompare } from './hooks/useSegmentCompare';
import { useActivitySync } from './hooks/useActivitySync';
import type { SegmentEffort } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { CompareCharts } from './components/CompareCharts';

const SegmentCompare = () => {
    const { athlete } = useAuth();

    const {
        loading,
        error,
        fetchSegmentList,
        fetchEffortsForSegment,
        fetchStreamsForEffort
    } = useSegmentCompare();

    const { syncStatus, syncActivity } = useActivitySync();

    const [segments, setSegments] = useState<Segment[]>([]);
    const [efforts, setEfforts] = useState<SegmentEffort[]>([]);
    const [streams, setStreams] = useState<Record<number, any>>({});
    const [chartLoading, setChartLoading] = useState(false);

    const selectedAthleteId = athlete?.id ? Number(athlete.id) : null;
    const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
    const [selectedEffortIds, setSelectedEffortIds] = useState<number[]>([]);
    const [manualInput, setManualInput] = useState('');

    useEffect(() => {
        if (selectedSegmentId) {
            setManualInput(selectedSegmentId.toString());
        } else {
            setManualInput('');
        }
    }, [selectedSegmentId]);

    // Fetch segments when athlete is available
    useEffect(() => {
        if (!selectedAthleteId) {
            setSegments([]);
            return;
        }
        const loadSegments = async () => {
            setSelectedSegmentId(null);
            setEfforts([]);
            setSelectedEffortIds([]);
            setStreams({});
            const list = await fetchSegmentList(selectedAthleteId);
            setSegments(list);
        };
        loadSegments();
    }, [selectedAthleteId, fetchSegmentList]);

    // Fetch efforts when segment changes
    useEffect(() => {
        if (!selectedSegmentId) {
            setEfforts([]);
            return;
        }
        const loadEfforts = async () => {
            const list = await fetchEffortsForSegment(selectedSegmentId, selectedAthleteId || undefined);
            setEfforts(list);
            setSelectedEffortIds([]);
            setStreams({});
        };
        loadEfforts();
    }, [selectedSegmentId, selectedAthleteId, fetchEffortsForSegment]);

    // Fetch streams for selected efforts
    useEffect(() => {
        const loadStreams = async () => {
            const missingIds = selectedEffortIds.filter(id => !streams[id]);
            if (missingIds.length === 0) return;

            setChartLoading(true);
            const newStreams = { ...streams };

            await Promise.all(missingIds.map(async (id) => {
                const effort = efforts.find(e => e.activity_id === id);
                if (!effort) return;

                const streamData = await fetchStreamsForEffort(id, effort.start_index, effort.end_index);
                if (streamData) {
                    newStreams[id] = streamData;
                }
            }));

            setStreams(newStreams);
            setChartLoading(false);
        };

        if (selectedEffortIds.length > 0) {
            loadStreams();
        }
    }, [selectedEffortIds, efforts, fetchStreamsForEffort]); // streams dependency removed to avoid infinite loop if logic flaw, though logic seems safe

    const handleToggleEffort = (effortId: number) => {
        setSelectedEffortIds(prev => {
            if (prev.includes(effortId)) {
                return prev.filter(id => id !== effortId);
            }
            if (prev.length >= 5) {
                return prev;
            }
            return [...prev, effortId];
        });
    };

    const selectedEffortsSorted = efforts.filter(e => selectedEffortIds.includes(e.activity_id));
    selectedEffortsSorted.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    const athleteName = athlete ? `${athlete.firstname} ${athlete.lastname}`.trim() : '未登入';

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 pb-20">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <ArrowLeftRight className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">活動比較</h1>
                        <p className="text-slate-400 text-sm">與歷史紀錄比較，分析路段表現差異</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">當前選手</label>
                        <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5 text-sm text-slate-300 flex items-center gap-2">
                            {athlete?.profile && (
                                <img src={athlete.profile} alt={athleteName} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{athleteName}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">選擇路段</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedSegmentId || ''}
                                    onChange={e => setSelectedSegmentId(Number(e.target.value) || null)}
                                    disabled={!selectedAthleteId}
                                >
                                    <option value="">請選擇路段...</option>
                                    {segments.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                    {selectedSegmentId && !segments.find(s => s.id === selectedSegmentId) && (
                                        <option value={selectedSegmentId}>
                                            {efforts.length > 0 ? efforts[0].segment_name : `Segment ${selectedSegmentId}`}
                                        </option>
                                    )}
                                </select>
                            </div>
                            <div className="w-32">
                                <input
                                    type="text"
                                    placeholder="路段 ID"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = Number(manualInput);
                                            if (val > 0) setSelectedSegmentId(val);
                                        }
                                    }}
                                    onBlur={() => {
                                        const val = Number(manualInput);
                                        if (val > 0 && val !== selectedSegmentId) setSelectedSegmentId(val);
                                    }}
                                    disabled={!selectedAthleteId}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        錯誤: {error}
                    </div>
                )}

                {/* Content Area */}
                {/* Charts Section - Full Width at Top */}
                {(efforts.length > 0) && (
                    <div className="w-full">
                        <CompareCharts
                            allEfforts={efforts}
                            selectedEfforts={selectedEffortsSorted}
                            streams={streams}
                            loading={chartLoading}
                            segment={segments.find(s => s.id === selectedSegmentId)}
                            onSync={syncActivity}
                            syncStatus={syncStatus}
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Effort List */}
                    <div className="lg:col-span-1 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden flex flex-col max-h-[600px]">
                        <div className="p-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
                            <h3 className="font-semibold flex items-center justify-between">
                                <span>歷史紀錄</span>
                                <span className="text-xs font-normal text-slate-400">
                                    {selectedEffortIds.length}/5 已選擇
                                </span>
                            </h3>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading && efforts.length === 0 ? (
                                <div className="p-8 flex justify-center text-slate-500">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : efforts.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">
                                    {!selectedSegmentId ? '請先選擇路段' : '無紀錄'}
                                </div>
                            ) : (
                                efforts.map(effort => {
                                    const isSelected = selectedEffortIds.includes(effort.activity_id);
                                    return (
                                        <div
                                            key={effort.activity_id}
                                            onClick={() => handleToggleEffort(effort.activity_id)}
                                            className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${isSelected
                                                ? 'bg-blue-500/10 border-blue-500/50'
                                                : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800/80'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600'
                                                }`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate text-slate-200">
                                                    {format(new Date(effort.start_date), 'yyyy-MM-dd')}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                                    <span>{effort.activity_name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-mono mt-1 text-slate-300">
                                                    <span>⏱ {new Date(effort.elapsed_time * 1000).toISOString().substr(11, 8)}</span>
                                                    <span>⚡ {effort.average_watts || '-'}w</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Charts & Table */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Charts Area moved to top */}

                        {selectedEffortsSorted.length === 0 ? (
                            <div className="h-[200px] flex flex-col items-center justify-center bg-slate-900/30 rounded-xl border border-dashed border-slate-800 text-slate-500">
                                <ArrowLeftRight className="w-12 h-12 mb-4 opacity-20" />
                                <h3 className="text-lg font-medium text-slate-400">開始比較活動</h3>
                                <p className="text-sm">選擇最多 5 筆活動進行並排比較</p>
                            </div>
                        ) : (
                            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                                <div className="p-4 border-b border-slate-800">
                                    <h3 className="font-semibold">比較分析</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                                                <th className="p-4 font-medium border-b border-slate-800">日期</th>
                                                <th className="p-4 font-medium border-b border-slate-800">時間</th>
                                                <th className="p-4 font-medium border-b border-slate-800">平均功率</th>
                                                <th className="p-4 font-medium border-b border-slate-800">活動名稱</th>
                                                <th className="p-4 font-medium border-b border-slate-800">移動時間</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {selectedEffortsSorted.map(e => (
                                                <tr key={e.activity_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                    <td className="p-4 font-medium text-slate-200">
                                                        {format(new Date(e.start_date), 'yyyy-MM-dd')}
                                                    </td>
                                                    <td className="p-4 font-mono font-medium text-slate-300">
                                                        {new Date(e.elapsed_time * 1000).toISOString().substr(11, 8)}
                                                    </td>
                                                    <td className="p-4 font-mono font-medium text-slate-300">
                                                        {e.average_watts} <span className="text-xs text-slate-500">W</span>
                                                    </td>
                                                    <td className="p-4 text-xs text-slate-400">
                                                        {e.activity_name}
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-400">
                                                        {new Date(e.moving_time * 1000).toISOString().substr(11, 8)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {/* Summary / Insights could go here */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SegmentCompare;
