
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

    const generateDailySummary = useCallback(async (userId: string, date: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch('/api/ai/summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId, date }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to generate summary');
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

    // Placeholder for future chat functionality
    const sendChatMessage = useCallback(async (message: string) => {
        // TODO: Implement chat API call
        console.log("Sending message:", message);
        return { reply: "Chat feature coming soon!" };
    }, []);

    return {
        loading,
        error,
        summary,
        generateDailySummary,
        sendChatMessage
    };
}
