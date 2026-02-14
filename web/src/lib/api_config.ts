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

        // 如果是維修中常用的狀態碼 (502 Gateway Error, 503 Service Unavailable, 504 Gateway Timeout)
        if ([502, 503, 504].includes(response.status)) {
            window.dispatchEvent(new CustomEvent('tcu-api-maintenance', { detail: { maintenance: true } }));
        } else if (response.ok) {
            // 如果連線成功，則主動解除維修狀態
            window.dispatchEvent(new CustomEvent('tcu-api-maintenance', { detail: { maintenance: false } }));
        }

        return response;
    } catch (error) {
        console.error(`[API] Fetch failed for ${endpoint}:`, error);

        // 通常 fetch 拋出錯誤代表連線被拒絕 (Connection Refused) 或 DNS 失敗，這也視為維修中
        if (error instanceof TypeError) {
            window.dispatchEvent(new CustomEvent('tcu-api-maintenance', { detail: { maintenance: true } }));
        }

        throw error;
    }
};

