
import React from 'react';
import { Zap, Sparkles, Activity, ShieldCheck, ChevronRight, BarChart3, BrainCircuit, Globe } from 'lucide-react';
import StravaConnect from '../auth/StravaConnect';

const LandingPage: React.FC = () => {
    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/30">
            {/* 英雄區 (Hero Section) */}
            <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
                {/* 背景裝飾 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-20">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/30 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        <div className="flex-1 text-center lg:text-left space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-primary text-xs font-black uppercase tracking-widest">
                                <Zap className="w-3 h-3 fill-primary" />
                                下一世代功率分析平台
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-tight">
                                Unlock Your<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">
                                    Peak Performance
                                </span>
                            </h1>
                            <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                不僅僅是 Strava 數據。透過 AI 驅動的深入洞察、MMP 建模與專業級 GoldenCheetah 整合，將你的騎乘表現提升到全新境界。
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                                <div className="p-1 bg-gradient-to-r from-primary to-orange-500 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-95">
                                    <StravaConnect />
                                </div>
                                <button className="flex items-center gap-2 px-6 py-3 text-sm font-bold border border-slate-800 rounded-2xl hover:bg-slate-900 transition-colors group text-foreground">
                                    瞭解更多功能 <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>

                            <div className="flex items-center justify-center lg:justify-start gap-6 pt-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                            {String.fromCharCode(64 + i)}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-black text-foreground">500+ Athletes</div>
                                    <div className="text-xs text-muted-foreground">已經加入 TCU POWER 社群</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative animate-in fade-in slide-in-from-right-8 duration-1000">
                            <div className="relative rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl shadow-blue-500/10">
                                <img
                                    src="/assets/landing/hero-cycling.png"
                                    alt="STRAVAPower Performance Analysis"
                                    className="w-full h-auto object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

                                {/* 漂浮卡片裝飾 */}
                                <div className="absolute top-8 right-8 p-4 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl animate-bounce-slow">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">NP (Normalized Power)</div>
                                            <div className="text-lg font-black italic font-mono">284 W</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 背景光環 */}
                            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-600/5 rounded-full blur-[100px]" />
                        </div>
                    </div>
                </div>
            </section>

            {/* 核心功能區 (Features) */}
            <section className="py-24 bg-slate-900/30 border-y border-slate-900/50">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                        <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em]">Core Intelligence</h2>
                        <h3 className="text-3xl md:text-5xl font-black italic uppercase text-foreground">超越 Strava 的數據分析</h3>
                        <p className="text-muted-foreground font-medium">我們整合了專業自由車教練的邏輯，將冰冷的數據轉化為能夠指引你訓練的具體建議。</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <BrainCircuit className="w-6 h-6" />,
                                title: "AI 智能教練",
                                description: "基於你最近的訓練負荷、MMP 曲線與疲勞程度，自動生成每日總結與訓練指引。",
                                color: "primary"
                            },
                            {
                                icon: <BarChart3 className="w-6 h-6" />,
                                title: "專業功率建模",
                                description: "實作 MMP (Mean Maximal Power) 與 CP (Critical Power) 模型，精準追蹤你的體能進步。",
                                color: "orange-500"
                            },
                            {
                                icon: <Globe className="w-6 h-6" />,
                                title: "GoldenCheetah 整合",
                                description: "在網頁端直接存取專業級的開源分析工具指標，讓專業數據觸手可及。",
                                color: "blue-500"
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="group p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-primary/50 transition-all hover:bg-slate-800/50 cursor-default">
                                <div className={`w-14 h-14 rounded-2xl bg-${feature.color === 'primary' ? 'primary' : feature.color}/10 flex items-center justify-center text-${feature.color === 'primary' ? 'primary' : feature.color} mb-6 group-hover:scale-110 transition-transform`}>
                                    {feature.icon}
                                </div>
                                <h4 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h4>
                                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* AI Coach 聚焦 (Spotlight) */}
            <section className="py-24 relative overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="flex-1 order-2 lg:order-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                                        <Sparkles className="w-5 h-5 text-primary mb-2" />
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">今日建議</div>
                                        <div className="text-sm font-medium text-foreground">建議進行 Z2 基礎耐力訓練，配合 3 組 10 分鐘的高轉速練習。</div>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">PMC Status</div>
                                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[65%]" />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-8 space-y-4">
                                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Activity className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-400 uppercase">Recovery</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground italic">"休息是訓練的一部分。你的 TSB 為 +12，身體狀況非常適合高強度衝刺測試。"</div>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-slate-800/50 border border-primary/30 relative overflow-hidden">
                                        <BrainCircuit className="w-8 h-8 text-primary opacity-50 absolute -right-4 -bottom-4" />
                                        <div className="text-lg font-black text-foreground">AI Coaching</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 order-1 lg:order-2 space-y-8 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest">
                                <Sparkles className="w-3 h-3" />
                                AI-First Intelligence
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black italic uppercase leading-tight text-foreground">
                                你的 24/7 <br />
                                <span className="text-primary">數位教練</span>
                            </h2>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                TCU POWER AI 不只是解析數據，它會根據你的歷史表現與設定的目標（如武嶺挑戰、聯賽搶分），提供客製化的訓練規劃建議與風險警示。
                            </p>
                            <ul className="space-y-4 text-left">
                                {[
                                    "自動化訓練日報 (Training Summary)",
                                    "TSB/CTL/ATL 疲勞度追蹤",
                                    "MMP 關鍵衝刺能力分析",
                                    "個人化功率區間調整策略"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-300 font-bold">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                            <ChevronRight className="w-3 h-3 text-primary" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* 最後行動呼籲 (CTA) */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/10 blur-[100px] pointer-events-none" />
                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-4xl mx-auto p-12 md:p-16 rounded-[3rem] bg-slate-900/80 backdrop-blur-xl border border-white/10 text-center space-y-8 shadow-2xl">
                        <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-foreground">
                            準備好<br />
                            <span className="text-primary">解鎖潛力了嗎？</span>
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                            一鍵同步 Strava 活動，開始體驗專業級的數據分析。完全免費。
                        </p>
                        <div className="flex justify-center flex-col sm:flex-row items-center gap-4 pt-4">
                            <div className="p-1 bg-gradient-to-r from-primary to-orange-500 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.05] active:scale-95">
                                <StravaConnect />
                            </div>
                            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-700 text-sm font-bold text-foreground">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                TCU 官方認證平台
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 頁尾 (Footer) */}
            <footer className="py-12 border-t border-slate-900 bg-background/80">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-3 opacity-60">
                            <span className="text-xl font-black italic tracking-tighter uppercase whitespace-nowrap text-foreground">
                                TCU <span className="text-primary">POWER</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-8 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <a href="#" className="hover:text-primary transition-colors">隱私條款</a>
                            <a href="#" className="hover:text-primary transition-colors">服務協議</a>
                            <a href="#" className="hover:text-primary transition-colors">聯絡我們</a>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-slate-700 tracking-[0.2em] uppercase">
                            © 2026 TCU CYCLING ADVENTURE. ALL RIGHTS RESERVED.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
