
import React, { useState, useEffect, useRef } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api_config';
import StravaLogo from '../../components/ui/StravaLogo';

interface StravaAthlete {
    id: string | number;
    username?: string;
    firstname?: string;
    lastname?: string;
    firstName?: string;
    lastName?: string;
    profile?: string;
    profile_medium?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
}

const CONFIG = {
    stravaAuthUrl: 'https://service.criterium.tw/webhook/strava/auth/start',
    storageKey: 'strava_athlete_data',
    pollingInterval: 1000,
    pollingTimeout: 120000,
    allowedOrigins: [
        'https://service.criterium.tw',
        'https://criterium.tw',
        'https://strava.criterium.tw',
        'http://localhost:3000',
        'http://localhost:5173',
        API_BASE_URL,
    ]
};

const StravaConnect: React.FC = () => {
    const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const authWindowRef = useRef<Window | null>(null);

    const stopPolling = () => {
        if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
        }
        if (authWindowRef.current && !authWindowRef.current.closed) {
            authWindowRef.current.close();
        }
        authWindowRef.current = null;
        setIsLoading(false);
    };

    const saveAndSetAthlete = (athleteData: StravaAthlete) => {
        const fullData = {
            ...athleteData,
            firstname: athleteData.firstname || athleteData.firstName || '',
            lastname: athleteData.lastname || athleteData.lastName || '',
            ts: Date.now()
        };
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(fullData));
        setAthlete(fullData);
        setIsLoading(false);

        // 通知全局狀態更新 (由 useAuth 監聽並同步 Token)
        window.dispatchEvent(new Event('strava-auth-changed'));
    };

    const checkStoredData = () => {
        const tempData = localStorage.getItem(CONFIG.storageKey + '_temp');
        if (tempData) {
            try {
                const athleteData = JSON.parse(tempData);
                localStorage.removeItem(CONFIG.storageKey + '_temp');
                saveAndSetAthlete(athleteData);
                stopPolling();
                return true;
            } catch (e) {
                console.error('處理授權暫存資料失敗', e);
            }
        }
        return false;
    };

    const startPolling = () => {
        const startTime = Date.now();
        pollingTimerRef.current = setInterval(() => {
            if (Date.now() - startTime > CONFIG.pollingTimeout) {
                stopPolling();
                alert('授權超時，請重試');
                return;
            }

            try {
                if (authWindowRef.current && authWindowRef.current.closed) {
                    checkStoredData();
                    stopPolling();
                    return;
                }
            } catch (e) { }
            checkStoredData();
        }, CONFIG.pollingInterval);
    };

    const handleConnect = () => {
        setIsLoading(true);
        localStorage.removeItem(CONFIG.storageKey + '_temp');

        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const returnUrl = encodeURIComponent(window.location.href);
        const url = `${CONFIG.stravaAuthUrl}?return_url=${returnUrl}`;

        authWindowRef.current = window.open(
            url,
            'strava_auth',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        if (!authWindowRef.current) {
            setIsLoading(false);
            alert('請允許彈出視窗以進行 Strava 授權');
            return;
        }
        startPolling();
    };

    const handleDisconnect = async () => {
        if (athlete?.id) {
            try {
                await fetch('https://service.criterium.tw/webhook/strava/auth/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ athlete_id: athlete.id })
                });
            } catch (e) {
                console.error('發送取消連結 Webhook 失敗', e);
            }
        }

        localStorage.removeItem(CONFIG.storageKey);
        localStorage.removeItem(CONFIG.storageKey + '_temp');
        setAthlete(null);
        window.dispatchEvent(new Event('strava-auth-changed'));
    };

    useEffect(() => {
        const savedData = localStorage.getItem(CONFIG.storageKey);
        if (savedData) {
            try { setAthlete(JSON.parse(savedData)); } catch (e) { }
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'STRAVA_AUTH_SUCCESS') {
                stopPolling();
                const fullData = { ...event.data, ...(event.data.athlete || {}) };
                saveAndSetAthlete(fullData);
            }
        };

        const handleAuthChange = () => {
            const saved = localStorage.getItem(CONFIG.storageKey);
            setAthlete(saved ? JSON.parse(saved) : null);
        };

        window.addEventListener('message', handleMessage);
        window.addEventListener('strava-auth-changed', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);

        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('strava-auth-changed', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
            stopPolling();
        };
    }, []);

    if (athlete) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="relative">
                        <img
                            src={athlete.profile_medium || athlete.profile || "https://www.strava.com/assets/users/placeholder_athlete.png"}
                            alt="Profile"
                            className="w-12 h-12 rounded-full border-2 border-strava-orange shadow-sm"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-tcu-blue text-white rounded-full p-0.5 shadow-sm">
                            <Check className="w-3 h-3" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-slate-900 dark:text-white font-black text-base uppercase truncate leading-tight">
                            {`${athlete.firstname || athlete.firstName || ''} ${athlete.lastname || athlete.lastName || ''}`.trim() || `Athlete #${athlete.id}`}
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                            Strava ID: {athlete.id}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleDisconnect}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                >
                    中斷連結
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <button
                onClick={handleConnect}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-3 bg-strava-orange text-white py-4 px-6 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
            >
                {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <StravaLogo className="h-5 w-auto" color="white" />}
                <span className="text-sm font-black uppercase tracking-wider">
                    {isLoading ? '授權中...' : 'Connect with Strava'}
                </span>
            </button>
        </div>
    );
};

export default StravaConnect;
