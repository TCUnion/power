
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column: Daily Summary - Full width on mobile, Left on tablet/desktop */}
                <div className="col-span-1 space-y-6">
                    <div className="bg-card rounded-lg p-4 shadow-sm border border-border flex items-center justify-between">
                        <div>
                            <span className="text-sm text-muted-foreground block">日期</span>
                            <span className="font-medium text-foreground">{format(selectedDate, 'yyyy-MM-dd')}</span>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !athlete}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
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
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm border border-destructive/20">
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
                        <div className="bg-muted rounded-lg p-8 text-center border border-dashed border-border">
                            <p className="text-muted-foreground text-sm">點擊「生成日誌」來獲取今天的訓練分析。</p>
                        </div>
                    )}
                </div>


                {/* Right Column: Chat Interface - Full width on mobile, Right on tablet, Spans 2 cols on Desktop */}
                <div className="col-span-1 lg:col-span-2 h-[600px] lg:h-[800px]">
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
