import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth as useAuth } from '../../contexts/AdminAuthContext';
import { toast } from 'sonner';


interface AdPlacement {
    id: number;
    brand_name: string;
    product_name: string;
    product_url: string;
    description: string;
    trigger_keywords: string[] | null;
    placement_text: string;
    priority: number;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    current_impressions: number;
    max_impressions: number | null;
    created_at: string;
}

export default function AdminDashboard() {
    const { user, signOut } = useAuth();
    const [ads, setAds] = useState<AdPlacement[]>([]);
    const [activeTab, setActiveTab] = useState<'ads' | 'settings'>('ads');
    const [settings, setSettings] = useState<{ key: string, value: string, description: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAd, setEditingAd] = useState<AdPlacement | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        brand_name: '',
        product_name: '',
        product_url: '',
        description: '',
        trigger_keywords_input: '',
        placement_text: '',
        priority: 5,
        is_active: true,
        start_date: '',
        end_date: '',
        max_impressions: ''
    });

    useEffect(() => {
        if (activeTab === 'ads') fetchAds();
        if (activeTab === 'settings') fetchSettings();
    }, [activeTab]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('system_settings').select('*').order('key');
            if (error) throw error;
            setSettings(data || []);
        } catch (e: any) {
            toast.error('無法載入設定: ' + e.message);
        }
        setLoading(false);
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const updates = settings.map(s => ({
                key: s.key,
                value: s.value,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('system_settings').upsert(updates);
            if (error) throw error;

            toast.success('設定已儲存');
        } catch (e: any) {
            toast.error('儲存失敗: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (key: string, value: string) => {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    };

    const fetchAds = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('ad_placements')
            .select('*')
            .order('priority', { ascending: true })
            .order('id', { ascending: false });

        if (error) {
            toast.error('無法載入廣告列表');
            console.error(error);
        } else {
            setAds(data || []);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await signOut();
        window.location.href = '/admin/login';
    };

    const openModal = (ad?: AdPlacement) => {
        if (ad) {
            setEditingAd(ad);
            setFormData({
                brand_name: ad.brand_name,
                product_name: ad.product_name,
                product_url: ad.product_url || '',
                description: ad.description,
                trigger_keywords_input: ad.trigger_keywords ? ad.trigger_keywords.join(', ') : '',
                placement_text: ad.placement_text,
                priority: ad.priority,
                is_active: ad.is_active,
                start_date: ad.start_date || '',
                end_date: ad.end_date || '',
                max_impressions: ad.max_impressions?.toString() || ''
            });
        } else {
            setEditingAd(null);
            setFormData({
                brand_name: '',
                product_name: '',
                product_url: '',
                description: '',
                trigger_keywords_input: '',
                placement_text: '',
                priority: 5,
                is_active: true,
                start_date: '',
                end_date: '',
                max_impressions: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (asNew: boolean = false) => {
        // 解析關鍵字 string -> array
        const trigger_keywords = formData.trigger_keywords_input
            .split(/[,，\n]/) // 支援中英文逗號與換行
            .map(k => k.trim())
            .filter(k => k.length > 0);

        const payload = {
            brand_name: formData.brand_name,
            product_name: asNew ? `${formData.product_name} (複製)` : formData.product_name,
            product_url: formData.product_url,
            description: formData.description,
            trigger_keywords: trigger_keywords,
            placement_text: formData.placement_text,
            priority: formData.priority,
            is_active: formData.is_active,
            max_impressions: formData.max_impressions ? parseInt(formData.max_impressions) : null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null
        };

        let error;
        // 如果是編輯模式且不是另存新檔 -> Update
        if (editingAd && !asNew) {
            const { error: updateError, data } = await supabase
                .from('ad_placements')
                .update(payload)
                .eq('id', editingAd.id)
                .select();

            if (!updateError && (!data || data.length === 0)) {
                error = { message: '更新失敗：權限不足或資料不存在 (RLS)' };
            } else {
                error = updateError;
            }
        } else {
            // 新增或是另存新檔 -> Insert
            const { error: insertError, data } = await supabase
                .from('ad_placements')
                .insert([payload])
                .select();

            if (!insertError && (!data || data.length === 0)) {
                error = { message: '新增失敗：權限不足 (RLS)' };
            } else {
                error = insertError;
            }
        }

        if (error) {
            toast.error('儲存失敗: ' + error.message);
        } else {
            toast.success(asNew ? '已另存為新廣告' : '儲存成功');
            setIsModalOpen(false);
            fetchAds();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('確定要刪除此廣告嗎？此動作無法復原。')) return;

        const { error } = await supabase.from('ad_placements').delete().eq('id', id);
        if (error) {
            toast.error('刪除失敗');
        } else {
            toast.success('已刪除');
            fetchAds();
        }
    };

    const toggleActive = async (ad: AdPlacement) => {
        const { error } = await supabase
            .from('ad_placements')
            .update({ is_active: !ad.is_active })
            .eq('id', ad.id);

        if (error) toast.error('更新狀態失敗');
        else fetchAds();
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">管理後台</h1>
                        <p className="text-sm text-gray-500 mt-1">目前登入：{user?.email} (Admin)</p>
                    </div>
                    <button onClick={handleLogout} className="text-red-600 hover:text-red-800 font-medium">
                        登出
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('ads')}
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'ads' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        廣告管理
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        系統設定
                    </button>
                </div>

                {activeTab === 'settings' ? (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">AI 教練配額設定</h2>
                        {loading ? <p>載入中...</p> : (
                            <form onSubmit={handleSaveSettings} className="space-y-6 max-w-lg">
                                {settings.map((setting) => (
                                    <div key={setting.key}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {setting.description || setting.key}
                                        </label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                value={setting.value}
                                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                            />
                                            <span className="ml-2 text-gray-500 text-sm">次/日</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Key: {setting.key}</p>
                                    </div>
                                ))}

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        儲存設定
                                    </button>
                                </div>
                            </form>
                        )}
                        {!loading && settings.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                尚無設定資料。請確認資料庫初始化腳本是否已執行。
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        {/* Ads Content */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">廣告列表</h2>
                            <button
                                onClick={() => openModal()}
                                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                            >
                                + 新增廣告
                            </button>
                        </div>

                        {loading ? (
                            <p className="text-center text-gray-500">載入中...</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-max divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-sm">操作</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                                            {/* ... header items ... */}
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">優先序</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌 / 商品</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">連結</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">推薦文案</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">AI 描述</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">檔期 (起~迄)</th>
                                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">曝光 (現/限)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {ads.map((ad) => (
                                            <tr key={ad.id} className={!ad.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium sticky left-0 bg-white z-10 shadow-sm space-x-2">
                                                    <button onClick={() => openModal(ad)} className="text-indigo-600 hover:text-indigo-900">編輯</button>
                                                    <button onClick={() => handleDelete(ad.id)} className="text-red-600 hover:text-red-900">刪除</button>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => toggleActive(ad)}
                                                        className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ad.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                                    >
                                                        {ad.is_active ? '啟用' : '停用'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-center">{ad.priority}</td>
                                                <td className="px-3 py-4 max-w-xs">
                                                    <div className="text-sm font-medium text-gray-900 truncate" title={ad.brand_name}>{ad.brand_name}</div>
                                                    <div className="text-sm text-gray-500 truncate" title={ad.product_name}>{ad.product_name}</div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {ad.product_url ? (
                                                        <a href={ad.product_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                                                            🔗 開啟
                                                        </a>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500">
                                                    <div className="line-clamp-2 w-48" title={ad.placement_text}>{ad.placement_text}</div>
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500">
                                                    <div className="line-clamp-2 w-48" title={ad.description}>{ad.description}</div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <div className="text-xs">{ad.start_date || '即日起'}</div>
                                                    <div className="text-xs">~ {ad.end_date || '無限期'}</div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                    {ad.current_impressions} / {ad.max_impressions || '∞'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-xl font-semibold text-gray-900">
                                {editingAd ? '編輯廣告' : '新增廣告'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 text-2xl">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">品牌名稱</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.brand_name}
                                        onChange={e => setFormData({ ...formData, brand_name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">商品名稱</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.product_name}
                                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">商品連結 URL</label>
                                <input
                                    type="url"
                                    value={formData.product_url}
                                    onChange={e => setFormData({ ...formData, product_url: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">AI 判斷描述 (System Prompt 用)</label>
                                <textarea
                                    required
                                    rows={2}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    placeholder="例如：適合爬坡訓練後的補給..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">觸發關鍵字 (用逗號分隔)</label>
                                <input
                                    type="text"
                                    value={formData.trigger_keywords_input}
                                    onChange={e => setFormData({ ...formData, trigger_keywords_input: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    placeholder="例如：爬坡, 補給, 功率"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">推薦文案 (AI 回覆用)</label>
                                <textarea
                                    required
                                    rows={2}
                                    value={formData.placement_text}
                                    onChange={e => setFormData({ ...formData, placement_text: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    placeholder="一句話推薦理由..."
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">優先序 (1=最高)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">最大曝光數 (空白=無限)</label>
                                    <input
                                        type="number"
                                        value={formData.max_impressions}
                                        onChange={e => setFormData({ ...formData, max_impressions: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div className="flex items-center pt-6">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label className="ml-2 block text-sm text-gray-900">啟用中</label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">上架日期</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">下架日期</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                            </div>

                            <div className="mt-5 sm:mt-6 flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleSave(true)}
                                    className="inline-flex justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                                >
                                    另存新檔
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                >
                                    儲存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
