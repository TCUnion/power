import { MessageSquare, Calendar, ChevronRight, Loader2, Copy, Check, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

interface DailySummaryMetrics {
    total_time_min: number;
    total_distance_km: number;
    activities_count: number;
    details: string[];
}

interface DailySummaryProps {
    summary: string;
    metrics: DailySummaryMetrics;
    isLoading?: boolean;
    onCopyRaw?: () => Promise<string>;
}

import { highlightKeywords } from '../../../utils/textHighlighting';

export function DailySummaryCard({ summary, metrics, isLoading, onCopyRaw }: DailySummaryProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [isCopying, setIsCopying] = useState(false);

    const handleCopy = async () => {
        if (isCopying) return;
        setIsCopying(true);
        try {
            let content = summary;
            if (onCopyRaw) {
                const rawData = await onCopyRaw();
                if (rawData) content = rawData;
            }
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        } finally {
            setIsCopying(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-slate-900 rounded-lg shadow-lg p-8 flex flex-col items-center justify-center min-h-[300px] border border-white/10 md:bg-slate-900/50 md:backdrop-blur-xl">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                <p className="text-sm text-slate-200 animate-pulse font-medium">AI 教練正在分析數據...</p>
            </div>
        );
    }

    const processedSummary = highlightKeywords(summary);

    return (
        <div className="bg-slate-900 md:bg-slate-900/50 md:backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden border border-white/10 ring-1 ring-white/5">
            <div className="flex flex-col md:grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                {/* Left Side: Summary Content */}
                <div className="p-6 bg-gradient-to-b from-white/5 to-transparent relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-slate-50 flex items-center gap-2 tracking-wide">
                                <MessageSquare className="w-5 h-5 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                AI 教練日誌
                            </h2>
                            <div className="relative group">
                                <button
                                    onClick={handleCopy}
                                    disabled={isCopying}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-full 
                                        text-xs font-medium transition-all duration-300
                                        border 
                                        ${isCopied
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20 hover:text-indigo-200 hover:border-indigo-500/50 hover:shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                                        }
                                        ${isCopying ? "opacity-70 cursor-wait" : ""}
                                    `}
                                >
                                    {isCopying ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isCopied ? (
                                        <Check className="w-3.5 h-3.5" />
                                    ) : (
                                        <Bot className="w-3.5 h-3.5" />
                                    )}

                                    <span>{isCopied ? "已複製" : "複製給 AI 分析"}</span>
                                </button>

                                {/* Tooltip */}
                                {!isCopied && !isCopying && (
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] 
                                                    bg-slate-900/90 backdrop-blur border border-white/10 rounded-lg p-2 
                                                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                        <p className="text-[10px] text-slate-300 text-center leading-tight">
                                            複製包含心率與功率的原始數據<br />可直接貼給 ChatGPT/Gemini 進行分析
                                        </p>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-slate-900/90"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5" />
                            Today
                        </span>
                    </div>

                    <div className="prose prose-sm max-w-none 
                        text-slate-200 font-medium md:font-normal
                        prose-headings:text-slate-50 prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-bold
                        prose-p:my-2 prose-p:leading-relaxed
                        prose-strong:text-orange-500 prose-strong:font-bold prose-strong:drop-shadow-[0_0_2px_rgba(249,115,22,0.3)]
                        prose-ul:my-2 prose-li:my-1 prose-li:marker:text-orange-500
                        prose-a:text-yellow-400 prose-a:no-underline prose-a:border-b prose-a:border-yellow-400/50 hover:prose-a:border-yellow-400 prose-a:transition-all prose-a:drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]
                    ">
                        <ReactMarkdown>{processedSummary}</ReactMarkdown>
                    </div>
                </div>

                {/* Right Side: Metrics & Details */}
                <div className="bg-black/20 p-6 md:bg-transparent">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1 h-3 bg-orange-500 rounded-full"></div>
                        最新5筆資訊
                    </h3>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 text-center shadow-sm backdrop-blur-sm">
                            <div className="text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-tighter">總時間</div>
                            <div className="text-lg font-black text-slate-50 font-mono">
                                {metrics?.total_time_min ?? 0} <span className="text-[10px] font-normal text-slate-400 font-sans">min</span>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 text-center shadow-sm backdrop-blur-sm">
                            <div className="text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-tighter">總距離</div>
                            <div className="text-lg font-black text-slate-50 font-mono">
                                {metrics?.total_distance_km ?? 0} <span className="text-[10px] font-normal text-slate-400 font-sans">km</span>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 text-center shadow-sm backdrop-blur-sm col-span-2">
                            <div className="text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-tighter">活動數</div>
                            <div className="text-lg font-black text-slate-50 font-mono">{metrics?.activities_count ?? 0}</div>
                        </div>
                    </div>

                    {metrics?.details && metrics.details.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">詳細清單</p>
                            <div className="text-xs text-slate-300 space-y-1.5 px-1">
                                {metrics.details.slice(0, 5).map((detail, idx) => (
                                    <div key={idx} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
                                        <ChevronRight className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                                        <span className="leading-tight font-medium md:font-normal">{detail}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
