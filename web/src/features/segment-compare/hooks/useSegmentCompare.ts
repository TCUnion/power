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
                    .select('id, start_date')
                    .in('id', activityIds);

                if (!actError && activities) {
                    const activityMap = new Map(activities.map(a => [a.id, a.start_date]));
                    efforts.forEach(e => {
                        e.activity_start_date = activityMap.get(e.activity_id);
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
        dateInfo?: { activityStartDate: string, effortStartDate: string, elapsedTime: number }
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
                if (timeStream && Array.isArray(timeStream.data)) {
                    const activityStart = new Date(dateInfo.activityStartDate).getTime();
                    const effortStart = new Date(dateInfo.effortStartDate).getTime();
                    // Calculate offset in seconds
                    // strava_activities start_date is usually UTC ISO string
                    // effort_start_date from view is also UTC ISO string
                    const offsetSeconds = (effortStart - activityStart) / 1000;

                    // Allow some tolerance, e.g. 1 second
                    const targetStart = Math.max(0, offsetSeconds);
                    const targetEnd = targetStart + dateInfo.elapsedTime;

                    const times = timeStream.data as number[];

                    // Find indices
                    // Assuming sorted time stream
                    finalStart = times.findIndex(t => t >= targetStart);
                    // If exact match not found, findIndex returns first element >= target. 
                    // If -1, it means all times are smaller than targetStart (unlikely if data is valid)

                    if (finalStart !== -1) {
                        // Find end index
                        const endIdx = times.findIndex(t => t > targetEnd);
                        finalEnd = endIdx === -1 ? times.length - 1 : endIdx - 1;
                    } else {
                        // Fallback to 0 if something is wrong
                        finalStart = 0;
                        finalEnd = times.length - 1;
                    }
                }
            }

            // Slice the streams if we have valid indices
            if (typeof finalStart === 'number' && typeof finalEnd === 'number' && finalStart <= finalEnd) {
                const slicedStreams: any = {};
                streams.forEach(stream => {
                    if (stream.data && Array.isArray(stream.data)) {
                        slicedStreams[stream.type] = stream.data.slice(finalStart, finalEnd + 1);
                    }
                });
                return slicedStreams;
            }

            // Return all streams mapped by type if no slicing possible
            const allStreams: any = {};
            streams.forEach(stream => {
                allStreams[stream.type] = stream.data;
            });
            return allStreams;
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
