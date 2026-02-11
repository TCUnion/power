
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/api_config';
import { useAuth } from '../../hooks/useAuth';
import type { TCUMember } from '../../types';
import {
    UserCheck,
    Mail,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    ShieldCheck,
    Users,
    User,
    Hash,
    FileText,
    Zap,
    ExternalLink,
    Clock
} from 'lucide-react';


interface MemberBindingCardProps {
    onBindingSuccess: () => void;
}

const MemberBindingCard: React.FC<MemberBindingCardProps> = ({ onBindingSuccess }) => {
    const { athlete, isBound, memberData: authMemberData, refreshBinding } = useAuth();
    const [tcuId, setTcuId] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [step, setStep] = useState<'input' | 'otp' | 'success'>('input');
    const [localMemberData, setLocalMemberData] = useState<TCUMember | null>(null);
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    // const [isUnbinding, setIsUnbinding] = useState(false); // Unused for now

    // 有權威性的資料優先使用 useAuth 的 memberData
    const memberData = authMemberData || localMemberData;

    useEffect(() => {
        if (isBound) {
            setStep('success');
        } else if (!localMemberData) {
            setStep('input');
        }
    }, [isBound, localMemberData]);

    const handleSync = async () => {
        if (!tcuId.trim()) {
            setError('請輸入 TCU-ID 或身份證字號');
            return;
        }

        if (!athlete?.id) {
            setError('Strava 資料未載入，請重新登入 Strava 後再試。');
            return;
        }

        setIsSyncing(true);
        setError(null);

        try {
            const { data, error } = await supabase
                .from('tcu_members')
                .select('*')
                .or(`account.eq.${tcuId.toUpperCase()},tcu_id.eq.${tcuId}`)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setError('查無此會員資料。請先至 https://www.tcu.com.tw/ 進行註冊。系統每天早上 9 點更新會員資料，請於更新後再試一次。');
            } else {
                setLocalMemberData(data);
                const result = await triggerOtp(data.email, data.real_name, tcuId);

                if (result.already_bound) {
                    setStep('success');
                    window.dispatchEvent(new Event('tcu-binding-success'));
                    setSuccess('已偵測到綁定狀態！');
                    onBindingSuccess();
                } else if (result.success) {
                    setStep('otp');
                } else {
                    setError(result.message || '發送驗證碼失敗');
                }
            }
        } catch (err) {
            console.error('同步錯誤:', err);
            setError('同步失敗，請稍後再試');
        } finally {
            setIsSyncing(false);
        }
    };

    const triggerOtp = async (email: string, name: string, inputId: string) => {
        try {
            const response = await fetch('https://service.criterium.tw/webhook/member-binding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    memberName: name,
                    stravaId: athlete?.id,
                    input_id: inputId,
                    action: 'generate_otp'
                })
            });
            const text = await response.text();

            if (!response.ok) {
                // 嘗試解析錯誤訊息
                try {
                    const json = JSON.parse(text);
                    return { success: false, message: json.message || response.statusText };
                } catch {
                    return { success: false, message: `伺服器回應錯誤: ${response.status} ${response.statusText}` };
                }
            }

            // 成功狀態下處理
            try {
                if (!text.trim()) {
                    // 空回應視為成功
                    return { success: true };
                }
                return JSON.parse(text);
            } catch (jsonError) {
                console.warn('JSON 解析失敗，但 HTTP 200，視為成功:', jsonError);
                return { success: true, message: '請求已發送' };
            }
        } catch (err) {
            console.error('OTP trigger failed:', err);
            return { success: false, message: '與伺服器連線失敗' };
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) return;
        if (!athlete?.id) {
            setError('Strava 資料未載入，無法綁定。');
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            // 驗證 OTP (仍從 tcu_members 檢查)
            if (!memberData?.email) {
                setError('會員資料缺失，請重新輸入 TCU-ID。');
                return;
            }

            const { data, error } = await supabase
                .from('tcu_members')
                .select('*')
                .eq('email', memberData.email)
                .eq('otp_code', otp)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setError('驗證碼錯誤或已過期。');
            } else {
                // 取得當前 Supabase Auth User ID (若有的話)
                const { data: { user } } = await supabase.auth.getUser();

                // 呼叫 confirm-binding API 寫入 strava_member_bindings 表格
                const response = await apiFetch('/api/auth/confirm-binding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: data.email,
                        stravaId: athlete.id,
                        tcu_account: data.account || tcuId,
                        member_name: data.real_name,
                        user_id: user?.id // 傳遞 Auth ID 建立綁定
                    })
                });

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.message || '綁定確認失敗');
                }

                // 清除 OTP (可選，保持 tcu_members 乾淨)
                await supabase
                    .from('tcu_members')
                    .update({ otp_code: null, otp_expires_at: null })
                    .eq('email', data.email);

                setStep('success');
                setSuccess('綁定成功！');
                setLocalMemberData(result.member_data || data); // 使用回傳的最新資料

                // 主動觸發全局狀態刷新
                if (refreshBinding) refreshBinding();
                window.dispatchEvent(new Event('tcu-binding-success'));
                // onBindingSuccess(); // 移除自動跳轉，改由按鈕觸發
            }
        } catch (err: unknown) {
            console.error('驗證錯誤:', err);
            setError(err instanceof Error ? err.message : '驗證失敗，請重新嘗試。');
        } finally {
            setIsVerifying(false);
        }
    };

    if ((isBound || step === 'success') && memberData) {
        return (
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl"></div>
                <div className="relative z-10 flex flex-col gap-8">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white text-2xl font-black italic uppercase tracking-tight">TCU 會員資料</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        {memberData?.member_type || '正式會員'}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                        <Hash className="w-3 h-3" />
                                        {memberData?.tcu_id}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">

                        {/* Section 1: Basic Info */}
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <User className="w-4 h-4" /> 基本資料
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">真實姓名</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-slate-900 dark:text-white">{memberData?.real_name}</span>
                                        {memberData?.nickname && <span className="text-sm font-bold text-slate-500">({memberData.nickname})</span>}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">所屬車隊</p>
                                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                        <Users className="w-4 h-4 text-emerald-500" />
                                        <span className="text-base font-bold truncate">{memberData?.team || '未填寫'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>



                        {/* Section 3: Profile & Skills */}
                        {(memberData?.self_introduction || memberData?.skills) && (
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> 個人簡介 & 技能
                                </h4>
                                <div className="space-y-4">
                                    {memberData?.self_introduction && (
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                                {memberData.self_introduction}
                                            </p>
                                        </div>
                                    )}
                                    {memberData?.skills && (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-wrap gap-2">
                                                {(memberData.skills as string).split('\n').map((skill: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                        {skill}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">若要修正能力分組，請前往</span>
                                                <a
                                                    href="https://strava.criterium.tw/skill"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-black text-tcu-blue hover:text-tcu-blue-light hover:underline flex items-center gap-1 transition-colors"
                                                >
                                                    能力分組修正頁面
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer Info: Profile Edit & Update Time */}
                    <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-bold text-slate-400">
                        <div className="flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>若需修改個人資料，請前往</span>
                            <a
                                href="https://www.tsu.com.tw/member-data/profile"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-tcu-blue hover:text-tcu-blue-light hover:underline transition-colors uppercase tracking-wider"
                            >
                                TCU 會員中心
                            </a>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            <span>每日會員資料更新時間 08:00</span>
                        </div>
                    </div>


                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-tcu-blue/5 rounded-full blur-3xl group-hover:bg-tcu-blue/10 transition-colors"></div>
            <div className="relative z-10 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-sm">
                        <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white text-xl font-black italic uppercase">TCU 會員身份連結 (選用)</h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Connect your profile for personalized stats and rankings</p>
                    </div>
                </div>

                {step === 'input' ? (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Member TCU-ID / Account</label>
                            <div className="relative group">
                                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-tcu-blue transition-colors" />
                                <input
                                    type="text"
                                    value={tcuId}
                                    onChange={(e) => setTcuId(e.target.value)}
                                    placeholder="輸入 TCU-ID 或身分證號"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-tcu-blue transition-all"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing || !tcuId}
                            className={`group relative overflow-hidden w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg ${isSyncing || !tcuId
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-tcu-blue text-white shadow-tcu-blue/20 hover:shadow-tcu-blue/40'
                                }`}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>確認中...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>驗證身份</span>
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-tcu-blue/5 dark:bg-tcu-blue/10 border border-tcu-blue/20 rounded-2xl p-4 flex items-start gap-3">
                            <Mail className="w-5 h-5 text-tcu-blue mt-0.5" />
                            <div>
                                <p className="text-slate-900 dark:text-white text-xs font-black uppercase">驗證郵件已發送</p>
                                <p className="text-slate-500 text-[10px] font-bold mt-1">
                                    請檢查您的電子郵件 <b>{memberData?.email}</b>，並輸入信中的 6 位數驗證碼。
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Verification Code</label>
                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="000000"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl py-4 text-center text-2xl font-black tracking-[0.5em] text-tcu-blue focus:outline-none focus:border-tcu-blue transition-all"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep('input')}
                                className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                返回
                            </button>
                            <button
                                onClick={handleVerifyOtp}
                                disabled={isVerifying || otp.length < 6}
                                className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg ${isVerifying || otp.length < 6
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:shadow-emerald-500/40'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    <span>{isVerifying ? '驗證中...' : '確認綁定'}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Error & Success Messages */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl animate-in fade-in duration-300">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="text-[10px] font-bold text-red-600 leading-normal uppercase">
                            {(() => {
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                const parts = error.split(urlRegex);
                                return parts.map((part, i) =>
                                    urlRegex.test(part) ? (
                                        <a
                                            key={i}
                                            href={part}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors font-black"
                                        >
                                            {part}
                                        </a>
                                    ) : (
                                        <span key={i}>{part}</span>
                                    )
                                );
                            })()}
                        </div>
                    </div>
                )}

                {success && (
                    <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl animate-in fade-in duration-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-600 leading-normal uppercase">{success}</p>
                    </div>
                )}

                <div className="pt-2">
                    <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest text-center leading-loose">
                        綁定即代表您同意將 Strava 騎乘數據提供給 TCU 進行積分採計與級別分析。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MemberBindingCard;
