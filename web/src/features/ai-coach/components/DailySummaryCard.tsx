
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

export function DailySummaryCard({ summary, metrics, isLoading }: DailySummaryProps) {
    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-6 animate-pulse border border-gray-100">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        <div className="h-6 bg-gray-200 rounded w-32"></div>
                    </div>
                    <div className="h-4 bg-gray-100 rounded w-20"></div>
                </div>
                <div className="space-y-4 mb-8">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-11/12"></div>
                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                    <div className="h-20 bg-gray-50 rounded-lg"></div>
                    <div className="h-20 bg-gray-50 rounded-lg"></div>
                    <div className="h-20 bg-gray-50 rounded-lg"></div>
                </div>
                <div className="mt-6 text-center">
                    <p className="text-xs font-medium text-gray-400">AI 正在分析數據，請稍候...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        AI 教練日誌
                    </h2>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Today
                    </span>
                </div>

                <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-indigo-600 prose-a:font-bold prose-strong:font-bold">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">今日數據概覽</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded border border-gray-200 text-center">
                        <div className="text-xs text-gray-500 mb-1">總時間</div>
                        <div className="font-bold text-gray-900">
                            {metrics?.total_time_min ?? 0} <span className="text-xs font-normal text-gray-400">min</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200 text-center">
                        <div className="text-xs text-gray-500 mb-1">總距離</div>
                        <div className="font-bold text-gray-900">
                            {metrics?.total_distance_km ?? 0} <span className="text-xs font-normal text-gray-400">km</span>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200 text-center">
                        <div className="text-xs text-gray-500 mb-1">活動數</div>
                        <div className="font-bold text-gray-900">{metrics?.activities_count ?? 0}</div>
                    </div>
                </div>
                {metrics?.details && metrics.details.length > 0 && (
                    <div className="mt-4 text-xs text-gray-500">
                        {metrics.details.map((detail, idx) => (
                            <div key={idx} className="flex items-center gap-1 mb-1 last:mb-0">
                                <ChevronRight className="w-3 h-3 text-gray-400" />
                                {detail}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
