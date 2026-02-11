export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_BACKUP_URL = import.meta.env.VITE_API_BACKUP_URL || '';

/**
 * 統一的 API 请求處理函數，支援自動切換至備援伺服器
 * @param endpoint API 路徑 (例如 '/api/auth/status')
 * @param options fetch 選項
 * @returns Response 物件
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    // 1. 嘗試主伺服器
    try {
        const primaryUrl = `${API_BASE_URL}${endpoint}`;
        const response = await fetch(primaryUrl, options);

        // 若主伺服器回應 5xx (伺服器錯誤)，則視為失敗，嘗試備援
        if (response.status >= 500 && API_BACKUP_URL) {
            console.warn(`[API] Primary server error (${response.status}), trying backup...`);
            throw new Error(`Primary server error: ${response.status}`);
        }

        return response;
    } catch (error) {
        // 2. 失敗時嘗試備援伺服器 (若有設定)
        if (API_BACKUP_URL) {
            console.warn('[API] Primary connection failed, switching to backup:', error);
            try {
                const backupUrl = `${API_BACKUP_URL}${endpoint}`;
                const backupResponse = await fetch(backupUrl, options);
                return backupResponse;
            } catch (backupError) {
                console.error('[API] Backup server also failed:', backupError);
                throw error; // 若備援也失敗，拋出原始錯誤或最後的錯誤
            }
        }

        throw error;
    }
};

