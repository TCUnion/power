import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import type { TrainingLoadSummary } from '../../../types';

// 訓練負荷卡片 - 優化手機版
export const TrainingLoadCard: React.FC<{
    load: TrainingLoadSummary;
    ftp: number;
    sportType?: string;
    hasStravaZones?: boolean;
    onUpdateFtp?: (newFtp: number) => void;
}> = ({ load, ftp, sportType, hasStravaZones, onUpdateFtp }) => {
    const [isEditingFtp, setIsEditingFtp] = useState(false);
    const [editFtpValue, setEditFtpValue] = useState(ftp.toString());
    const [updating, setUpdating] = useState(false);

    const handleSaveFtp = async () => {
        if (!onUpdateFtp) return;
        const val = parseInt(editFtpValue, 10);
        if (isNaN(val) || val <= 0) return;

        setUpdating(true);
        await onUpdateFtp(val);
        setUpdating(false);
        setIsEditingFtp(false);
    };

    const isPowerSport = sportType === 'Ride' || sportType === 'VirtualRide';

    return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {/* FTP (Editable) */}
            <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-slate-700/40 relative group">
                {isEditingFtp ? (
                    <div className="flex flex-col items-center justify-center">
                        <input
                            type="number"
                            value={editFtpValue}
                            onChange={(e) => setEditFtpValue(e.target.value)}
                            className="w-14 px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-center text-white text-base font-bold mb-1 focus:outline-none focus:border-yellow-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveFtp()}
                        />
                        <div className="flex gap-1 text-[10px]">
                            <button onClick={handleSaveFtp} disabled={updating} className="text-emerald-400">
                                {updating ? '...' : '儲存'}
                            </button>
                            <button onClick={() => setIsEditingFtp(false)} className="text-slate-400">取消</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div
                            className={`text-lg sm:text-xl font-bold ${ftp > 0 ? 'text-blue-400' : 'text-red-400 animate-pulse'} cursor-pointer hover:text-blue-300 flex items-center justify-center gap-0.5`}
                            onClick={() => { setEditFtpValue(ftp.toString()); setIsEditingFtp(true); }}
                            title="點擊修改此活動的 FTP 設定"
                        >
                            {ftp > 0 ? ftp : '--'}
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                        <div className={`text-[9px] sm:text-[10px] mt-0.5 ${ftp > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                            設定 FTP (W)
                        </div>
                    </>
                )}
            </div>

            {/* Strava Zones Status - 更緊湊 */}
            {hasStravaZones && (
                <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-emerald-500/20">
                    <div className="text-lg sm:text-xl font-bold text-emerald-400">Strava</div>
                    <div className="text-[9px] sm:text-[10px] text-emerald-500/70 mt-0.5">
                        使用官方分析數據
                    </div>
                </div>
            )}

            {/* Power Metrics - Only for Ride */}
            {isPowerSport && (
                <>
                    {/* NP */}
                    <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-slate-700/40">
                        <div className="text-lg sm:text-xl font-bold text-yellow-400">{load.np}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">NP (W)</div>
                    </div>
                    {/* IF */}
                    <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-slate-700/40">
                        <div className="text-lg sm:text-xl font-bold text-orange-400">{load.if.toFixed(2)}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">強度因子</div>
                    </div>
                    {/* TSS */}
                    <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-slate-700/40">
                        <div className="text-lg sm:text-xl font-bold text-red-400">{load.tss}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">TSS</div>
                    </div>
                    {/* VI */}
                    <div className="bg-slate-800/60 rounded-lg p-2.5 sm:p-3 text-center border border-slate-700/40">
                        <div className="text-lg sm:text-xl font-bold text-purple-400">{load.vi.toFixed(2)}</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">變異指數</div>
                    </div>
                </>
            )}
        </div>
    );
};
