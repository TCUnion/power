import { MessageSquare, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
}

import { highlightKeywords } from '../../../utils/textHighlighting';

export function DailySummaryCard({ summary, metrics, isLoading }: DailySummaryProps) {
    if (isLoading) {
        return (
            <div className="bg-zinc-900/50 rounded-lg shadow-lg p-8 flex flex-col items-center justify-center min-h-[300px] border border-white/10 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-sm text-gray-400 animate-pulse">AI 教練正在分析數據...</p>
            </div>
        );
    }

    const processedSummary = highlightKeywords(summary);

    return (
        <div className="bg-zinc-900 rounded-xl shadow-2xl overflow-hidden border border-white/10 ring-1 ring-white/5">
            <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-wide">
                        <MessageSquare className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                        AI 教練日誌
                    </h2>
                    <span className="text-sm text-gray-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-4 h-4" />
                        Today
                    </span>
                </div>

                <div className="prose prose-sm max-w-none 
                    text-gray-300 
                    prose-headings:text-white prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-bold
                    prose-p:my-2 prose-p:leading-relaxed
                    prose-strong:text-[#F97316] prose-strong:font-bold prose-strong:drop-shadow-[0_0_2px_rgba(249,115,22,0.3)]
                    prose-ul:my-2 prose-li:my-1 prose-li:marker:text-primary
                    prose-a:text-yellow-400 prose-a:no-underline prose-a:border-b prose-a:border-yellow-400/50 hover:prose-a:border-yellow-400 prose-a:transition-all prose-a:drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]
                ">
                    <ReactMarkdown>{processedSummary}</ReactMarkdown>
                </div>
            </div>

            <div className="bg-black/20 px-4 md:px-6 py-4 border-t border-white/5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full"></div>
                    今日數據概覽
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-card p-2 md:p-3 rounded border border-border text-center shadow-sm">
                        <div className="text-[10px] md:text-xs text-muted-foreground mb-1">總時間</div>
                        <div className="text-sm md:text-base font-bold text-foreground font-mono">
                            {metrics?.total_time_min ?? 0} <span className="text-[10px] font-normal text-muted-foreground font-sans">min</span>
                        </div>
                    </div>
                    <div className="bg-card p-2 md:p-3 rounded border border-border text-center shadow-sm">
                        <div className="text-[10px] md:text-xs text-muted-foreground mb-1">總距離</div>
                        <div className="text-sm md:text-base font-bold text-foreground font-mono">
                            {metrics?.total_distance_km ?? 0} <span className="text-[10px] font-normal text-muted-foreground font-sans">km</span>
                        </div>
                    </div>
                    <div className="bg-card p-2 md:p-3 rounded border border-border text-center shadow-sm col-span-2 sm:col-span-1">
                        <div className="text-[10px] md:text-xs text-muted-foreground mb-1">活動數</div>
                        <div className="text-sm md:text-base font-bold text-foreground font-mono">{metrics?.activities_count ?? 0}</div>
                    </div>
                </div>
                {metrics?.details && metrics.details.length > 0 && (
                    <div className="mt-4 text-xs text-muted-foreground">
                        {metrics.details.map((detail, idx) => (
                            <div key={idx} className="flex items-center gap-1 mb-1 last:mb-0">
                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                {detail}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
