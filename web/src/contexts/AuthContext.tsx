
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api_config';

export interface StravaAthlete {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    profile: string;
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
}

interface AuthContextType {
    athlete: StravaAthlete | null;
    isBound: boolean;
    memberData: any;
    isAdmin: boolean;
    isLoading: boolean;
    logout: () => void;
    refreshBinding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'strava_athlete_data';
const AUTH_EVENT = 'strava-auth-changed';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
    const [isBound, setIsBound] = useState(false);
    const [memberData, setMemberData] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 全域冷卻鎖（Provider 級別）
    const lastSyncTime = useRef<number>(0);
    const lastBindingCheckTime = useRef<number>(0);

    const loadAthleteFromStorage = useCallback(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const athleteData = JSON.parse(savedData);
                setAthlete(athleteData);
                return athleteData;
            } catch (err) {
                console.error('Failed to parse athlete data', err);
                return null;
            }
        }
        setAthlete(null);
        return null;
    }, []);

    const syncToken = useCallback(async (athleteData: StravaAthlete) => {
        const now = Date.now();
        if (now - lastSyncTime.current < 5000) {
            return;
        }
        lastSyncTime.current = now;

        const numericId = Number(athleteData.id);
        if (athleteData.access_token && !isNaN(numericId) && numericId !== 0) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                await fetch(`${API_BASE_URL}/api/auth/strava-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        athlete_id: numericId,
                        access_token: athleteData.access_token,
                        refresh_token: athleteData.refresh_token || '',
                        expires_at: athleteData.expires_at || Math.floor(now / 1000) + 21600,
                        name: `${athleteData.firstname || ''} ${athleteData.lastname || ''}`.trim() || null,
                        user_id: user?.id
                    })
                });
                console.log('[AuthContext] Token 已同步');
            } catch (e) {
                console.warn('[AuthContext] Token 同步失敗', e);
                lastSyncTime.current = 0;
            }
        }
    }, []);

    const checkBindingStatus = useCallback(async (athleteId: number) => {
        const now = Date.now();
        if (now - lastBindingCheckTime.current < 5000) {
            return;
        }
        lastBindingCheckTime.current = now;

        try {
            const apiRes = await fetch(`${API_BASE_URL}/api/auth/binding-status/${athleteId}`);
            if (!apiRes.ok) throw new Error('API request failed');

            const data = await apiRes.json();
            setIsBound(data.isBound || false);
            setMemberData(data.member_data || null);

            if (data.strava_name) {
                const savedDataStr = localStorage.getItem(STORAGE_KEY);
                const currentAthlete = savedDataStr ? JSON.parse(savedDataStr) : null;
                const serverName = data.strava_name;
                const currentName = `${currentAthlete?.firstname || ''} ${currentAthlete?.lastname || ''}`.trim();

                if (currentName.includes('undefined') || (currentName !== serverName && serverName !== '')) {
                    console.log(`[AuthContext] 校正名稱: "${currentName}" -> "${serverName}"`);
                    const newAthleteData = {
                        ...currentAthlete,
                        firstname: serverName,
                        lastname: '',
                        ts: Date.now()
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAthleteData));
                    setAthlete(newAthleteData as StravaAthlete);
                    syncToken(newAthleteData as StravaAthlete);
                }
            }
        } catch (err) {
            console.warn('[AuthContext] 檢查綁定失敗:', err);
            lastBindingCheckTime.current = 0;
        }
    }, [syncToken]);

    const checkAdminStatus = useCallback(async (athleteId: number) => {
        try {
            const { data, error } = await supabase
                .from('manager_roles')
                .select('role, is_active')
                .eq('athlete_id', athleteId)
                .maybeSingle();

            if (error) throw error;
            setIsAdmin(data?.role === 'admin' && data?.is_active === true);
        } catch (err) {
            console.error('Failed to check admin status', err);
            setIsAdmin(false);
        }
    }, []);

    const logout = () => {
        localStorage.removeItem(STORAGE_KEY);
        setAthlete(null);
        setIsBound(false);
        setMemberData(null);
        setIsAdmin(false);
        lastSyncTime.current = 0;
        lastBindingCheckTime.current = 0;
        window.dispatchEvent(new Event(AUTH_EVENT));
    };

    const refreshBinding = useCallback(() => {
        if (athlete?.id) {
            lastBindingCheckTime.current = 0;
            checkBindingStatus(Number(athlete.id));
        }
    }, [athlete?.id, checkBindingStatus]);

    useEffect(() => {
        const handleAuthChange = async () => {
            const current = loadAthleteFromStorage();
            if (current) {
                setIsLoading(true);
                const aid = Number(current.id);
                try {
                    // 同步執行 binding 和 admin 檢查
                    await Promise.all([
                        checkBindingStatus(aid),
                        checkAdminStatus(aid)
                    ]);
                } finally {
                    setIsLoading(false);
                }
                // 背景同步 token
                syncToken(current);
            } else {
                setIsLoading(false);
            }
        };

        // 初始載入
        handleAuthChange();

        window.addEventListener(AUTH_EVENT, handleAuthChange);
        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('tcu-binding-success', () => {
            refreshBinding();
        });

        return () => {
            window.removeEventListener(AUTH_EVENT, handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
        };
    }, [loadAthleteFromStorage, checkBindingStatus, checkAdminStatus, syncToken, refreshBinding]);

    return (
        <AuthContext.Provider value={{ athlete, isBound, memberData, isAdmin, isLoading, logout, refreshBinding }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};
