
import { useState, useEffect } from 'react';
import { useAICoach } from './hooks/useAICoach';
import { DailySummaryCard } from './components/DailySummaryCard';
import { DataChatInterface } from './components/DataChatInterface';
import { Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthContext } from '../../contexts/AuthContext';
import MemberBindingCard from '../auth/MemberBindingCard';

export function AICoachPage() {
    const { athlete, isBound, isLoading: authLoading } = useAuthContext();

    const { generateDailySummary, sendChatMessage, loading, error, summary, usageStatus, checkUsageStatus } = useAICoach();

    console.log('[AICoachPage] State:', { loading, hasSummary: !!summary, error });


    const [selectedDate] = useState(new Date());


    // Auto-generate on load & check usage
    useEffect(() => {
        if (athlete?.id) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
            checkUsageStatus(athlete.id.toString());
        }
    }, [athlete?.id, selectedDate, generateDailySummary, checkUsageStatus]);

    const handleGenerate = () => {
        if (athlete?.id) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
        }
    };

    // NOTE: 權限檢查 - 載入中顯示 spinner
    if (authLoading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    // NOTE: 權限檢查 - 未綁定會員顯示綁定卡片
    if (!isBound) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl flex items-center justify-center min-h-[400px]">
                <div className="max-w-md w-full space-y-6 text-center">
                    <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xl">
                        <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-4 opacity-50" />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">需要會員綁定</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            「AI 功率教練」功能僅限已綁定 TCU 會員的用戶使用。請先完成 Strava 帳號與會員資料的綁定。
                        </p>
                        <MemberBindingCard onBindingSuccess={() => { }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-[1600px]">
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
                            <span className="font-medium text-gray-900">{format(selectedDate, 'yyyy-MM-dd')}</span>
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

                    {summary || loading ? (
                        <DailySummaryCard
                            summary={summary?.summary || ''}
                            metrics={summary?.metrics || { total_time_min: 0, total_distance_km: 0, activities_count: 0, details: [] }}
                            isLoading={loading}
                        />
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-8 text-center border border-dashed border-gray-300">
                            <p className="text-gray-500 text-sm">點擊「生成日誌」來獲取今天的訓練分析。</p>
                        </div>
                    )}
                </div>


                {/* Right Column: Chat Interface */}
                <div className="lg:col-span-2">
                    <DataChatInterface
                        onSendMessage={(msg) => {

                            if (!athlete?.id) return Promise.resolve({ reply: "請先綁定 Strava 帳號" });
                            return sendChatMessage(athlete.id.toString(), msg);
                        }}
                        userName={usageStatus?.member_name || athlete?.firstname}
                        usageStatus={usageStatus}
                    />
                </div>
            </div>
        </div>
    );
}
