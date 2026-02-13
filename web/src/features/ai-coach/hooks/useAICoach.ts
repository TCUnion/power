
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

export function useAICoach() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<DailySummary | null>(null);

    // NOTE: 每日摘要透過 n8n Webhook 產生，傳入 athlete_id 與日期
    const generateDailySummary = useCallback(async (userId: string, date: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('https://service.criterium.tw/webhook/ai-coach-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ athlete_id: parseInt(userId, 10), date }),
            });

            if (!response.ok) {
                throw new Error(`每日摘要服務回應異常 (${response.status})`);
            }

            const data = await response.json();
            setSummary(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
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

    return {
        loading,
        error,
        summary,
        generateDailySummary,
        sendChatMessage
    };
}
