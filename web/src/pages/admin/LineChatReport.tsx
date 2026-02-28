import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

/**
 * LINE 對話紀錄介面
 */
interface ChatRecord {
    id: number;
    line_user_id: string;
    display_name: string | null;
    picture_url: string | null;
    message_text: string | null;
    message_type: string | null;
    message_id: string | null;
    ai_response: string | null;
    reply_token: string | null;
    source: string | null;
    group_id: string | null;
    created_at: string;
}

/**
 * 統計摘要介面
 */
interface ChatStats {
    totalChats: number;
    todayChats: number;
    uniqueUsers: number;
    aiResponseRate: number;
}

const PAGE_SIZE = 20;

/**
 * LINE 聊天報表元件
 * 顯示 LINE 聊天機器人的對話紀錄、統計摘要與使用者對話歷史
 */
export default function LineChatReport() {
    const [records, setRecords] = useState<ChatRecord[]>([]);
    const [stats, setStats] = useState<ChatStats>({
        totalChats: 0,
        todayChats: 0,
        uniqueUsers: 0,
        aiResponseRate: 0,
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [userHistory, setUserHistory] = useState<ChatRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // 取得統計摘要
    const fetchStats = useCallback(async () => {
        try {
            // 總對話數
            const { count: totalChats } = await supabase
                .from('line_chat_history')
                .select('id', { count: 'exact', head: true });

            // 今日對話數
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { count: todayChats } = await supabase
                .from('line_chat_history')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', todayStart.toISOString());

            // 活躍使用者數（不同 line_user_id）
            const { data: usersData } = await supabase
                .from('line_chat_history')
                .select('line_user_id')
                .not('line_user_id', 'is', null);

            const uniqueUserIds = new Set(usersData?.map(r => r.line_user_id));

            // AI 回覆率
            const { count: withResponse } = await supabase
                .from('line_chat_history')
                .select('id', { count: 'exact', head: true })
                .not('ai_response', 'is', null)
                .neq('ai_response', '');

            const responseRate = totalChats && totalChats > 0
                ? Math.round(((withResponse || 0) / totalChats) * 100)
                : 0;

            setStats({
                totalChats: totalChats || 0,
                todayChats: todayChats || 0,
                uniqueUsers: uniqueUserIds.size,
                aiResponseRate: responseRate,
            });
        } catch (e: any) {
            console.error('統計資料載入失敗:', e);
        }
    }, []);

    // 取得對話紀錄（帶分頁與搜尋）
    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('line_chat_history')
                .select('id, line_user_id, display_name, picture_url, message_text, message_type, message_id, ai_response, reply_token, source, group_id, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

            // 搜尋篩選：搜尋使用者名稱或訊息內容
            if (searchQuery.trim()) {
                query = query.or(`display_name.ilike.%${searchQuery}%,message_text.ilike.%${searchQuery}%`);
            }

            const { data, error, count } = await query;

            if (error) throw error;

            setRecords(data || []);
            setTotalCount(count || 0);
        } catch (e: any) {
            toast.error('無法載入對話紀錄: ' + e.message);
        }
        setLoading(false);
    }, [currentPage, searchQuery]);

    // 取得特定使用者的對話歷史
    const fetchUserHistory = useCallback(async (userId: string) => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('line_chat_history')
                .select('id, line_user_id, display_name, picture_url, message_text, message_type, message_id, ai_response, reply_token, source, group_id, created_at')
                .eq('line_user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setUserHistory(data || []);
        } catch (e: any) {
            toast.error('無法載入使用者歷史: ' + e.message);
        }
        setHistoryLoading(false);
    }, []);

    useEffect(() => {
        fetchStats();
        fetchRecords();
    }, [fetchStats, fetchRecords]);

    // 搜尋時重設頁碼
    useEffect(() => {
        setCurrentPage(0);
    }, [searchQuery]);

    // 展開使用者對話時自動載入歷史
    const handleToggleUser = useCallback((userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            setUserHistory([]);
        } else {
            setExpandedUserId(userId);
            fetchUserHistory(userId);
        }
    }, [expandedUserId, fetchUserHistory]);

    // 計算總頁數
    const totalPages = useMemo(() => Math.ceil(totalCount / PAGE_SIZE), [totalCount]);

    // 格式化時間
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 訊息類型標籤顏色
    const getTypeColor = (type: string | null) => {
        switch (type) {
            case 'text': return 'bg-blue-100 text-blue-800';
            case 'image': return 'bg-green-100 text-green-800';
            case 'video': return 'bg-purple-100 text-purple-800';
            case 'audio': return 'bg-yellow-100 text-yellow-800';
            case 'file': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            {/* 統計摘要卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="總對話數"
                    value={stats.totalChats.toLocaleString()}
                    icon="💬"
                    color="bg-blue-50 border-blue-200"
                />
                <StatCard
                    title="今日對話"
                    value={stats.todayChats.toLocaleString()}
                    icon="📅"
                    color="bg-green-50 border-green-200"
                />
                <StatCard
                    title="活躍使用者"
                    value={stats.uniqueUsers.toLocaleString()}
                    icon="👥"
                    color="bg-purple-50 border-purple-200"
                />
                <StatCard
                    title="AI 回覆率"
                    value={`${stats.aiResponseRate}%`}
                    icon="🤖"
                    color="bg-amber-50 border-amber-200"
                />
            </div>

            {/* 搜尋與篩選 */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="搜尋使用者名稱或訊息內容..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                        共 {totalCount.toLocaleString()} 筆紀錄
                    </div>
                </div>
            </div>

            {/* 對話紀錄表格 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        <span className="ml-3 text-gray-500">載入中...</span>
                    </div>
                ) : records.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-2">📭</p>
                        <p>尚無對話紀錄</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用者</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類型</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">訊息內容</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">AI 回覆</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {records.map((record) => (
                                        <tr
                                            key={record.id}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {formatTime(record.created_at)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleToggleUser(record.line_user_id)}
                                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                                                    title="點擊查看完整對話歷史"
                                                >
                                                    {record.picture_url ? (
                                                        <img
                                                            src={record.picture_url}
                                                            alt={record.display_name || '使用者'}
                                                            className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-indigo-300 transition-all"
                                                            width={32}
                                                            height={32}
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                                            👤
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                        {record.display_name || '未知使用者'}
                                                    </span>
                                                    <span className="text-xs text-gray-300 group-hover:text-indigo-300">
                                                        {expandedUserId === record.line_user_id ? '▲' : '▼'}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(record.message_type)}`}>
                                                    {record.message_type || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700">
                                                <div className="line-clamp-2 max-w-64" title={record.message_text || ''}>
                                                    {record.message_text || <span className="text-gray-300 italic">（非文字訊息）</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                <div className="line-clamp-3 max-w-80" title={record.ai_response || ''}>
                                                    {record.ai_response || <span className="text-gray-300 italic">（無回覆）</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 分頁 */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                                <div className="text-sm text-gray-500">
                                    第 {currentPage + 1} / {totalPages} 頁
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                        disabled={currentPage === 0}
                                        className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← 上一頁
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={currentPage >= totalPages - 1}
                                        className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        下一頁 →
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 使用者對話歷史面板 */}
            {expandedUserId && (
                <div className="bg-white rounded-lg shadow-lg border-2 border-indigo-100 overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-indigo-800">
                            📋 使用者對話歷史（最近 50 筆）
                        </h3>
                        <button
                            onClick={() => { setExpandedUserId(null); setUserHistory([]); }}
                            className="text-indigo-400 hover:text-indigo-600 text-lg transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {historyLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                            {userHistory.map((msg) => (
                                <div key={msg.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start gap-3">
                                        {/* 使用者訊息 */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                                                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${getTypeColor(msg.message_type)}`}>
                                                    {msg.message_type}
                                                </span>
                                            </div>
                                            {/* 使用者氣泡 */}
                                            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-800 mb-2 max-w-lg">
                                                {msg.message_text || <span className="text-gray-400 italic">（非文字訊息）</span>}
                                            </div>
                                            {/* AI 回覆氣泡 */}
                                            {msg.ai_response && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-lg ml-8">
                                                    <div className="text-[10px] text-blue-400 font-medium mb-1">🤖 AI 回覆</div>
                                                    <div className="whitespace-pre-wrap break-words">{msg.ai_response}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * 統計卡片子元件
 */
function StatCard({ title, value, icon, color }: {
    title: string;
    value: string;
    icon: string;
    color: string;
}) {
    return (
        <div className={`rounded-lg border p-4 ${color} transition-transform hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
        </div>
    );
}
