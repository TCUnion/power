import React from 'react';
import { ArrowLeft, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const PowerAnalysisPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black italic uppercase text-slate-900 dark:text-white flex items-center gap-2">
                            <Zap className="w-6 h-6 text-orange-500" />
                            Power Analysis
                        </h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                            Advanced Metrics & Deep Dive
                        </p>
                    </div>
                </div>

                {/* Mock Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Placeholder Cards */}
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="aspect-video bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between group cursor-pointer hover:border-orange-500/50 transition-colors">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                                <Zap className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                            </div>
                            <div className="space-y-1">
                                <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                                <div className="h-2 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-12 text-center">
                    <p className="text-slate-400 text-sm font-medium">此頁面為功能模擬預覽，更多詳細分析功能將於後續更新推出。</p>
                </div>
            </div>
        </div>
    );
};

export default PowerAnalysisPage;
