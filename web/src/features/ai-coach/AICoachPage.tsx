
import { useState, useEffect } from 'react';
import { useAICoach } from './hooks/useAICoach';
import { DailySummaryCard } from './components/DailySummaryCard';
import { DataChatInterface } from './components/DataChatInterface';
import { Sparkles, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthContext } from '../../contexts/AuthContext';
import MemberBindingCard from '../auth/MemberBindingCard';

export function AICoachPage() {
    const { athlete, isBound, isLoading: authLoading } = useAuthContext();

    const {
        generateDailySummary,
        sendChatMessage,
        loading,
        error,
        summary,
        usageStatus,
        checkUsageStatus,
        getChatHistory,
        chatHistory,
        isLoadingHistory
    } = useAICoach();


    const [selectedDate] = useState(new Date());
    const version = "v1.0.3";

    // Auto-generate on load & check usage
    useEffect(() => {
        if (athlete?.id && isBound) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
            checkUsageStatus(athlete.id.toString());
            getChatHistory(athlete.id.toString(), 5);
        }
    }, [athlete?.id, isBound, selectedDate, generateDailySummary, checkUsageStatus, getChatHistory]);

    const handleGenerate = () => {
        if (athlete?.id) {
            generateDailySummary(athlete.id.toString(), format(selectedDate, 'yyyy-MM-dd'));
        }
    };

    // NOTE: 權限檢查 - 載入中顯示 spinner
    if (authLoading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    // NOTE: 權限檢查 - 未綁定會員顯示綁定卡片
    if (!isBound) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-6xl flex items-center justify-center min-h-[400px]">
                <div className="max-w-md w-full space-y-6 text-center">
                    <div className="p-6 bg-card rounded-2xl border border-border shadow-xl">
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
                        <h2 className="text-xl font-bold text-foreground mb-2">需要會員綁定</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            「AI 功率教練」功能僅限已綁定 TCU 會員的用戶使用。請先完成 Strava 帳號與會員資料的綁定。
                        </p>
                        <MemberBindingCard onBindingSuccess={() => { }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-[1600px] bg-background min-h-screen">
            <header className="mb-6 md:mb-8 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center justify-center md:justify-start gap-3">
                    <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                    AI 智能教練 <span className="text-[10px] md:text-xs font-normal text-muted-foreground ml-1">{version}</span>
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-2">
                    透過 AI 分析你的騎乘數據，提供個人化建議與洞察。
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
                {/* Top Section: Daily Summary - Full width on desktop to support 2-column card internal layout */}
                <div className="col-span-1 lg:col-span-3 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                                <Calendar className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">分析日期</span>
                                <span className="text-base font-bold text-slate-100">{format(selectedDate, 'yyyy-MM-dd')}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !athlete}
                            className="bg-orange-500 text-white px-6 py-2.5 rounded-full text-sm font-black italic tracking-wider hover:bg-orange-600 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 group"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" />
                                    重新生成報告
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm border border-red-500/20 backdrop-blur-md">
                            <strong className="font-black italic uppercase mr-2">Error:</strong> {error}
                        </div>
                    )}

                    {summary || loading ? (
                        <DailySummaryCard
                            summary={summary?.summary || ''}
                            metrics={summary?.metrics || { total_time_min: 0, total_distance_km: 0, activities_count: 0, details: [] }}
                            isLoading={loading}
                        />
                    ) : (
                        <div className="bg-slate-900/30 backdrop-blur rounded-xl p-12 text-center border border-dashed border-white/10">
                            <Sparkles className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-50" />
                            <p className="text-slate-400 text-sm font-medium">點擊「重新生成報告」來獲取今日數據洞察。</p>
                        </div>
                    )}
                </div>

                {/* Bottom Section: Chat Interface - Spans full width for easier reading */}
                <div className="col-span-1 lg:col-span-3 h-[600px] lg:h-[800px]">
                    <DataChatInterface
                        onSendMessage={async (msg) => {
                            if (!athlete?.id) return Promise.resolve({ reply: "請先綁定 Strava 帳號" });
                            return sendChatMessage(athlete.id.toString(), msg);
                        }}
                        userName={athlete?.firstname || athlete?.username || '跑者'}
                        usageStatus={usageStatus}
                        initialMessages={chatHistory}
                        isLoadingHistory={isLoadingHistory}
                    />
                </div>
            </div>
        </div>
    );
}
