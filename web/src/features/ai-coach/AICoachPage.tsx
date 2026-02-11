
import { useState, useEffect } from 'react';
import { useAICoach } from './hooks/useAICoach';
import { DailySummaryCard } from './components/DailySummaryCard';
import { DataChatInterface } from './components/DataChatInterface';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';

export function AICoachPage() {
    const { athlete } = useAuth();
    const { generateDailySummary, loading, error, summary } = useAICoach();

    const [selectedDate] = useState(new Date());


    // Auto-generate on load
    useEffect(() => {
        if (athlete?.id) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
        }
    }, [athlete?.id, selectedDate, generateDailySummary]);

    const handleGenerate = () => {
        if (athlete?.id) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-indigo-600" />
                    AI 智能教練
                </h1>
                <p className="text-gray-500 mt-2">
                    透過 AI 分析你的騎乘數據，提供個人化建議與洞察。
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Daily Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <span className="text-sm text-gray-500 block">日期</span>
                            <span className="font-medium">{format(selectedDate, 'yyyy-MM-dd')}</span>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !athlete}
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    重新生成
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm border border-red-200">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {summary ? (
                        <DailySummaryCard
                            summary={summary.summary}
                            metrics={summary.metrics}
                        />
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
                            <p className="text-gray-500 text-sm">點擊「生成日誌」來獲取今天的訓練分析。</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Chat Interface */}
                <div className="lg:col-span-2">
                    <DataChatInterface />
                </div>
            </div>
        </div>
    );
}
