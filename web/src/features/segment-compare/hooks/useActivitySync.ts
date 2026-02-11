import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export const useActivitySync = () => {
    const { athlete } = useAuth();
    const [syncStatus, setSyncStatus] = useState<Record<number, SyncStatus>>({});
    const [lastSyncTime, setLastSyncTime] = useState<Record<number, number>>({});

    const syncActivity = useCallback(async (activityId: number) => {
        const now = Date.now();
        const lastTime = lastSyncTime[activityId] || 0;

        // Prevent frequent syncs (5 seconds cooldown)
        if (syncStatus[activityId] === 'syncing' || (now - lastTime < 5000)) return;

        setSyncStatus(prev => ({ ...prev, [activityId]: 'syncing' }));
        setLastSyncTime(prev => ({ ...prev, [activityId]: now }));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            // Strava Webhook Payload Simulation
            const payload = {
                aspect_type: "create",
                event_time: Math.floor(Date.now() / 1000),
                object_id: activityId,
                activity_id: activityId,
                object_type: "activity",
                owner_id: athlete?.id,
                subscription_id: 0,
                updates: {}
            };

            const response = await fetch('https://service.criterium.tw/webhook/strava-activity-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Poll for data availability
                let retries = 0;
                const maxRetries = 20;

                const checkData = async (): Promise<boolean> => {
                    const { data: streamData } = await supabase
                        .from('strava_streams')
                        .select('activity_id')
                        .eq('activity_id', activityId)
                        .maybeSingle();

                    if (streamData) {
                        setSyncStatus(prev => ({ ...prev, [activityId]: 'success' }));

                        // Reset status to idle after a delay
                        setTimeout(() => {
                            setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' }));
                        }, 2000);
                        return true;
                    }
                    return false;
                };

                const poll = async () => {
                    if (retries >= maxRetries) {
                        setSyncStatus(prev => ({ ...prev, [activityId]: 'error' }));
                        setTimeout(() => setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' })), 3000);
                        return;
                    }

                    const found = await checkData();
                    if (!found) {
                        retries++;
                        setTimeout(poll, 2000);
                    }
                };

                poll();
            } else {
                throw new Error('Webhook call failed');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Sync failed:', error);
            setSyncStatus(prev => ({ ...prev, [activityId]: 'error' }));
            setTimeout(() => setSyncStatus(prev => ({ ...prev, [activityId]: 'idle' })), 3000);
        }
    }, [athlete?.id, lastSyncTime, syncStatus]);

    return {
        syncStatus,
        syncActivity
    };
};
