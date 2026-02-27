import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Zap } from 'lucide-react';

interface FTPUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentFtp: number;
    onUpdate: (newFtp: number, effectiveDate: string) => Promise<boolean>;
}

export const FTPUpdateModal: React.FC<FTPUpdateModalProps> = ({
    isOpen,
    onClose,
    currentFtp,
    onUpdate
}) => {
    const [newFtp, setNewFtp] = useState<number>(currentFtp || 200);
    const [dateRange, setDateRange] = useState<'today' | '30days' | '42days' | 'all' | 'custom'>('42days');
    const [customDate, setCustomDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 42);
        return d.toISOString().split('T')[0];
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // NOTE: 每次開啟 Modal 或 currentFtp 變更時，同步更新內部狀態
    // 解決 useState 只在首次掛載時初始化的問題
    useEffect(() => {
        if (isOpen && currentFtp > 0) {
            setNewFtp(currentFtp);
            setErrorMsg(null);
        }
    }, [isOpen, currentFtp]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (newFtp <= 0) {
            setErrorMsg('FTP 必須大於 0');
            return;
        }

        let effectiveDate = new Date();
        switch (dateRange) {
            case 'today':
                effectiveDate.setHours(0, 0, 0, 0);
                break;
            case '30days':
                effectiveDate.setDate(effectiveDate.getDate() - 30);
                effectiveDate.setHours(0, 0, 0, 0);
                break;
            case '42days':
                effectiveDate.setDate(effectiveDate.getDate() - 42);
                effectiveDate.setHours(0, 0, 0, 0);
                break;
            case 'all':
                effectiveDate = new Date('2000-01-01');
                break;
            case 'custom':
                effectiveDate = new Date(customDate);
                break;
        }

        setIsUpdating(true);
        setErrorMsg(null);

        try {
            const dateStr = effectiveDate.toISOString();
            const success = await onUpdate(newFtp, dateStr);
            if (success) {
                onClose();
            } else {
                setErrorMsg('更新失敗，請稍後再試');
            }
        } catch (err) {
            setErrorMsg('發生例外錯誤');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        修改 FTP 設定
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                        disabled={isUpdating}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* FTP 輸入區 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">新的 FTP (瓦數)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                value={newFtp}
                                onChange={(e) => setNewFtp(Number(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-white text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none font-mono"
                                min="1"
                                max="500"
                            />
                            <span className="text-slate-400 font-mono">W</span>
                        </div>
                    </div>

                    {/* 生效日期選擇 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            變更溯及範圍
                        </label>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none mb-3"
                        >
                            <option value="today">僅套用至今後的活動</option>
                            <option value="30days">過去 30 天的活動</option>
                            <option value="42days">過去 42 天的活動（建議：包含 AI 報告區間）</option>
                            <option value="all">所有的活動</option>
                            <option value="custom">自訂日期...</option>
                        </select>

                        {dateRange === 'custom' && (
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
                            />
                        )}

                        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                            💡 提示：變更歷史活動的 FTP，將自動重新計算受影響期間內的 Training Stress Score (TSS)，進而反映在圖表的 PMC (CTL, ATL, TSB) 變化上。
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {errorMsg}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        disabled={isUpdating}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUpdating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                更新中...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                儲存並重新計算
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
