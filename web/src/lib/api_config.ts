export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * 統一的 API 请求處理函數
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    // 強化：在本地開發環境 (localhost) 下，強制所有 /api 請求導向本地後端
    let baseUrl = API_BASE_URL;
    if (import.meta.env.DEV && endpoint.startsWith('/api')) {
        // 在 Vite 開發模式下，不論 .env 怎麼寫，強制連往 8000 埠
        baseUrl = 'http://localhost:8000';
        console.log(`[API] Dev Mode Enforced: Calling ${baseUrl}${endpoint}`);
    }

    try {
        const url = `${baseUrl}${endpoint}`;
        const response = await fetch(url, options);

        // 如果回應 401 且不在本地開發環境，可視需求處理。但在本地端我們優先確保連線通暢。
        return response;
    } catch (error) {
        console.error(`[API] Fetch failed for ${endpoint}:`, error);
        throw error;
    }
};

