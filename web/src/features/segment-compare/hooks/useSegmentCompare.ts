import { useState, useCallback } from 'react';
import type { SegmentEffort } from '../../../types';
import { supabase } from '../../../lib/supabase';

export interface Segment {
    id: number;
    name: string;
    distance: number;
    total_elevation_gain: number;
}

export const useSegmentCompare = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSegmentList = useCallback(async (athleteId: number): Promise<Segment[]> => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get segment IDs from view_all_segment_efforts
            const { data: effortSegments, error: effortError } = await supabase
                .from('view_all_segment_efforts')
                .select('segment_id')
                .eq('athlete_id', athleteId);

            if (effortError) throw effortError;

            const segmentIds = Array.from(new Set(effortSegments.map(item => item.segment_id)));

            if (segmentIds.length === 0) return [];

            // 2. Fetch details from segments table
            // 2. Fetch details from segments table in chunks
            const segmentsData: any[] = [];
            const chunkSize = 50; // Batch size to avoid URL too long error

            for (let i = 0; i < segmentIds.length; i += chunkSize) {
                const chunk = segmentIds.slice(i, i + chunkSize);
                const { data, error } = await supabase
                    .from('segments')
                    .select('id, name, distance, total_elevation_gain')
                    .in('id', chunk);

                if (error) throw error;
                if (data) segmentsData.push(...data);
            }

            // 3. Map to Segment interface
            const result: Segment[] = segmentsData.map(s => ({
                id: s.id,
                name: s.name,
                distance: s.distance,
                total_elevation_gain: s.total_elevation_gain
            }));

            // Sort by name
            result.sort((a, b) => a.name.localeCompare(b.name));

            return result;
        } catch (err: any) {
            console.error('Error fetching segment list:', err);
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEffortsForSegment = useCallback(async (segmentId: number, athleteId?: number): Promise<SegmentEffort[]> => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('view_all_segment_efforts')
                .select('*')
                .eq('segment_id', segmentId)
                .order('start_date', { ascending: false });

            if (athleteId) {
                query = query.eq('athlete_id', athleteId);
            }

            const { data, error } = await query;

            if (error) throw error;

            const efforts = data as SegmentEffort[];

            // Fetch activity start dates to allow time-based slicing
            if (efforts.length > 0) {
                const activityIds = Array.from(new Set(efforts.map(e => e.activity_id)));
                const { data: activities, error: actError } = await supabase
                    .from('strava_activities')
                    .select('id, start_date, start_date_local')
                    .in('id', activityIds);

                if (!actError && activities) {
                    const activityMap = new Map(activities.map(a => [a.id, {
                        utc: a.start_date,
                        local: a.start_date_local
                    }]));
                    efforts.forEach(e => {
                        const dates = activityMap.get(e.activity_id);
                        if (dates) {
                            e.activity_start_date = dates.utc;
                            e.activity_start_date_local = dates.local;
                        }
                    });
                }
            }

            return efforts;
        } catch (err: any) {
            console.error('Error fetching efforts:', err);
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchActivityPolyline = useCallback(async (_activityId: number): Promise<string | null> => {
        // Map feature skipped for now as per user request
        return null;
    }, []);

    const fetchStreamsForEffort = useCallback(async (
        activityId: number,
        startIndex?: number,
        endIndex?: number,
        dateInfo?: { activityStartDate?: string, activityStartDateLocal?: string, effortStartDate: string, elapsedTime: number }
    ): Promise<any> => {
        try {
            const { data, error } = await supabase
                .from('strava_streams')
                .select('streams')
                .eq('activity_id', activityId)
                .maybeSingle();

            if (error) throw error;
            if (!data || !data.streams) return null;

            // Retrieve streams
            const streams = data.streams as any[];

            // Determine slicing indices
            let finalStart = startIndex;
            let finalEnd = endIndex;

            // If explicit indices are missing but we have date info, calculate them
            if ((typeof finalStart !== 'number' || typeof finalEnd !== 'number') && dateInfo) {
                const timeStream = streams.find(s => s.type === 'time');
                // Ensure timeStream has data array
                if (timeStream && Array.isArray(timeStream.data)) {

                    const times = timeStream.data as number[];
                    const lastStreamTime = times.length > 0 ? times[times.length - 1] : 0;
                    let offsetSeconds = -1;

                    // Strategy 1: UTC Slicing
                    if (dateInfo.activityStartDate) {
                        const activityStart = new Date(dateInfo.activityStartDate).getTime();
                        const effortStart = new Date(dateInfo.effortStartDate).getTime();
                        const offset = (effortStart - activityStart) / 1000;
                        // Check if offset is within reasonable bounds
                        if (offset >= -5 && offset <= lastStreamTime + 100) {
                            offsetSeconds = offset;
                            console.log(`[StreamSlicing] Used UTC offset: ${offset}s for activity ${activityId}`);
                        }
                    }

                    // Strategy 2: Local Time Slicing (if UTC failed)
                    if (offsetSeconds < 0 && dateInfo.activityStartDateLocal) {
                        const activityStartLocal = new Date(dateInfo.activityStartDateLocal).getTime();
                        const effortStart = new Date(dateInfo.effortStartDate).getTime();

                        const diff = (effortStart - activityStartLocal) / 1000;
                        if (diff >= -5 && diff <= lastStreamTime + 100) {
                            offsetSeconds = diff;
                            console.log(`[StreamSlicing] Used Local offset (Direct Diff): ${diff}s for activity ${activityId}`);
                        }
                    }

                    // STRICT SLICING:
                    // Only apply slicing if we found a valid offset
                    if (offsetSeconds >= -5) {
                        const targetStart = Math.max(0, offsetSeconds);
                        const targetEnd = targetStart + dateInfo.elapsedTime;

                        // Find start index
                        finalStart = times.findIndex(t => t >= targetStart);

                        if (finalStart !== -1) {
                            // Find end index
                            const endIdx = times.findIndex(t => t > targetEnd);
                            // If targetEnd is beyond the last point, take the last point
                            finalEnd = endIdx === -1 ? times.length - 1 : endIdx - 1;

                            // Safety check: ensure we capture at least some points if duration is short
                            if (finalEnd < finalStart) finalEnd = finalStart;
                        }
                    } else {
                        console.warn(`[StreamSlicing] Failed to calculate valid offset for activity ${activityId}.`);
                    }
                }
            }

            // Slice the streams if we have VALID indices
            if (typeof finalStart === 'number' && typeof finalEnd === 'number' && finalStart <= finalEnd) {
                const slicedStreams: any = {};
                streams.forEach(stream => {
                    if (stream.data && Array.isArray(stream.data)) {
                        slicedStreams[stream.type] = stream.data.slice(finalStart, finalEnd + 1);
                    }
                });
                return slicedStreams;
            }

            // CRITICAL CHANGE: 
            // If we couldn't slice, return null or empty to avoid showing WRONG (full) data
            console.warn(`[StreamSlicing] Could not slice streams for activity ${activityId}. Missing valid indices.`);
            return null;

        } catch (err) {
            console.error('Error fetching/parsing streams:', err);
            return null;
        }
    }, []);


    return {
        loading,
        error,
        fetchSegmentList,
        fetchEffortsForSegment,
        fetchActivityPolyline,
        fetchStreamsForEffort
    };
};
