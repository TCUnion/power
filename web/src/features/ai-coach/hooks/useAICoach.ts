
import { useState, useCallback } from 'react';
import { apiFetch } from '../../../lib/api_config';

interface DailySummary {
    summary: string;
    metrics: {
        total_time_min: number;
        total_distance_km: number;
        activities_count: number;
        details: string[];
    };
}

interface UsageStatus {
    current: number;
    limit: number;
    remaining: number;
    member_type: string;
    member_name: string;
}

export function useAICoach() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<DailySummary | null>(null);
    const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // NOTE: 取得今日用量
    const checkUsageStatus = useCallback(async (userId: string) => {
        try {
            const response = await apiFetch(`/api/ai/usage/${userId}`);
            if (response.ok) {
                const data = await response.json();
                setUsageStatus(data);
            }
        } catch (err) {
            console.error("Failed to check usage:", err);
        }
    }, []);

    // NOTE: 每日摘要透過 n8n Webhook 產生，傳入 athlete_id 與日期
    const generateDailySummary = useCallback(async (userId: string, date: string) => {
        setLoading(true);
        setError(null);


        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch('https://service.criterium.tw/webhook/ai-coach-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ athlete_id: parseInt(userId, 10), date }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`每日摘要服務回應異常 (${response.status})`);
            }

            let data = await response.json();

            // NOTE: 處理 n8n 可能回傳的陣列格式
            if (Array.isArray(data)) {
                data = data[0];
            }

            // NOTE: 相容性映射 - 同時支援快取格式與新生成格式
            const parsedSummary: DailySummary = {
                summary: data.summary || data.ai_response || '未收到分析結果。',
                metrics: data.metrics || data.context_data || {
                    total_time_min: 0,
                    total_distance_km: 0,
                    activities_count: 0,
                    details: []
                }
            };

            setSummary(parsedSummary);
            return parsedSummary;
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('AI 生成較為耗時，請稍候 30 秒後點擊「重新生成」再次更新。');
            } else {
                setError(err.message);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, []);


    // NOTE: AI Chat 改為呼叫後端 API，由後端進行權限檢查與 N8N 轉發
    const sendChatMessage = useCallback(async (userId: string, message: string) => {
        setLoading(true);
        try {
            // 使用 apiFetch 呼叫後端，支援自動切換備援
            const response = await apiFetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // 後端 ChatRequest 預期 user_id (此處傳入 Strava ID)
                body: JSON.stringify({ user_id: userId, message }),
            });

            if (!response.ok) {
                // 特殊處理 429 或其他狀態碼
                if (response.status === 429) {
                    return { reply: "今日額度已達上限。請明天再來，或升級會員以獲取更多額度。" };
                }
                throw new Error(`AI 教練服務回應異常 (${response.status})`);
            }

            const data = await response.json();

            // 更新 usage status
            if (data.usage) {
                setUsageStatus(prev => ({
                    ...prev,
                    current: data.usage.current,
                    limit: data.usage.limit,
                    remaining: Math.max(0, data.usage.limit - data.usage.current),
                    member_type: prev?.member_type || 'guest',
                    member_name: prev?.member_name || ''
                }));
            }

            // 檢查後端是否回傳 limit_reached (200 OK 但邏輯上限制)
            if (data.limit_reached) {
                return { reply: data.answer || "今日額度已達上限。" };
            }

            return { reply: data.answer || '未收到分析結果，請稍後再試。' };
        } catch (err: any) {
            console.error("Chat error:", err);
            return { reply: "抱歉，我現在無法回答你的問題。請稍後再試。" };
        } finally {
            setLoading(false);
        }
    }, []);

    // NOTE: 取得對話歷史
    const getChatHistory = useCallback(async (userId: string, limit: number = 5) => {
        setIsLoadingHistory(true);
        try {
            const response = await apiFetch(`/api/ai/history/${userId}?limit=${limit}`);
            if (response.ok) {
                const data = await response.json();
                setChatHistory(data);
                return data;
            }
            return [];
        } catch (err) {
            console.error("Failed to get chat history:", err);
            return [];
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    return {
        loading,
        error,
        summary,
        usageStatus,
        chatHistory,
        isLoadingHistory,
        checkUsageStatus,
        generateDailySummary,
        sendChatMessage,
        getChatHistory
    };
}
