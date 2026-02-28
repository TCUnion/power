import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

/**
 * LINE 會員綁定記錄介面
 */
interface MemberBinding {
    id: string;
    line_user_id: string;
    line_display_name: string | null;
    tcu_account: string;
    tcu_member_email: string | null;
    member_name: string | null;
    strava_id: string | null;
    bound_at: string;
    updated_at: string;
    status: string;
}

/**
 * LINE 會員綁定狀態元件
 * 顯示 LINE 與 TCU 會員帳號的綁定關係列表
 */
export default function LineMemberBindings() {
    const [bindings, setBindings] = useState<MemberBinding[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'unbound'>('all');

    // 取得會員綁定列表
    const fetchBindings = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('line_member_bindings')
                .select('id, line_user_id, line_display_name, tcu_account, tcu_member_email, member_name, strava_id, bound_at, updated_at, status')
                .order('bound_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setBindings(data || []);
        } catch (e: any) {
            toast.error('無法載入會員綁定: ' + e.message);
        }
        setLoading(false);
    }, [filter]);

    useEffect(() => {
        fetchBindings();
    }, [fetchBindings]);

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

    // 統計數據
    const activeCount = bindings.filter(b => b.status === 'active').length;
    const unboundCount = bindings.filter(b => b.status !== 'active').length;

    return (
        <div className="space-y-6">
            {/* 統計摘要 */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 bg-teal-50 border-teal-200 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🔗</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">總綁定數</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{bindings.length}</div>
                </div>
                <div className="rounded-lg border p-4 bg-green-50 border-green-200 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">✅</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">啟用中</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
                </div>
                <div className="rounded-lg border p-4 bg-red-50 border-red-200 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">❌</span>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">已解除</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{unboundCount}</div>
                </div>
            </div>

            {/* 篩選與表格 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800">🔗 LINE 會員綁定狀態</h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'unbound')}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        >
                            <option value="all">全部</option>
                            <option value="active">啟用中</option>
                            <option value="unbound">已解除</option>
                        </select>
                        <span className="text-xs text-gray-400">共 {bindings.length} 筆</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                        <span className="ml-3 text-gray-500">載入中...</span>
                    </div>
                ) : bindings.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-2">🔗</p>
                        <p>尚無綁定紀錄</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LINE 名稱</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">會員姓名</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TCU 帳號</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strava</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">綁定時間</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {bindings.map((b) => (
                                    <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${b.status !== 'active' ? 'opacity-50' : ''}`}>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${b.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {b.status === 'active' ? '✅ 啟用' : '❌ 解除'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {b.line_display_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                            {b.member_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {b.tcu_account}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {b.tcu_member_email || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            {b.strava_id ? (
                                                <a
                                                    href={`https://www.strava.com/athletes/${b.strava_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-orange-600 hover:text-orange-800 font-medium"
                                                >
                                                    🏃 {b.strava_id}
                                                </a>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {formatTime(b.bound_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
