
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StravaConnect from './features/auth/StravaConnect';

import PowerAnalysisPage from './features/power/PowerAnalysisPage';
import { Link as RouterLink } from 'react-router-dom';
import { Zap } from 'lucide-react';
import MemberBindingCard from './features/auth/MemberBindingCard';
import PowerDashboard from './features/power/PowerDashboard';
import tcuLogo from './assets/tcu-logo.png';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-tcu-blue/20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={tcuLogo} alt="TCU Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-black italic tracking-tighter uppercase hidden sm:block">
              RELEASE YOUR <span className="text-tcu-orange text-2xl">TCU POWER</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Future: User Menu */}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 pt-24 pb-12">
        {children}
      </main>
    </div>
  );
};

const HomePage: React.FC = () => {
  const { athlete, isBound, isLoading } = useAuth();

  // 未登入狀態
  if (!athlete) {
    return (
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            Unlock Your Potential
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Connect Strava to analyze your power data with AI-driven insights.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
          <StravaConnect />
        </div>
      </div>
    );
  }

  // 已登入狀態
  return (
    <div className={`mx-auto space-y-8 ${isBound ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div className="grid gap-8">
        {/* Strava 連結狀態 - 當已綁定且顯示 Dashboard 時可以考慮隱藏或縮小，這邊暫時保留但調整布局 */}
        {!isBound && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
            <StravaConnect />
          </div>
        )}

        {/* TCU 綁定卡片 */}
        <div className="md:col-span-1">
          <MemberBindingCard onBindingSuccess={() => { }} />
        </div>

        {/* 功率分析頁面進入按鈕 */}
        <div className="flex justify-center">
          {isBound ? (
            <RouterLink
              to="/analysis"
              className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
            >
              <Zap className="w-5 h-5 fill-white" />
              進入功率分析頁面
            </RouterLink>
          ) : (
            <div className="relative group w-full md:w-auto">
              <button
                disabled
                className="w-full md:w-auto px-8 py-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-black text-lg cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-wider transition-colors border border-slate-300 dark:border-slate-700"
              >
                <Zap className="w-5 h-5" />
                進入功率分析頁面
              </button>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none">
                需先完成 TCU 會員綁定以解鎖進階功能
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
              </div>
            </div>
          )}
        </div>

        {/* 功率儀表板 (包含 PMC) - 登入後即可查看 */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tcu-blue"></div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 儀表板標題或分隔線可選 */}
            <PowerDashboard />
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/power" element={<PowerDashboard />} />
          <Route path="/analysis" element={<PowerAnalysisPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
