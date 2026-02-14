import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StravaConnect from './features/auth/StravaConnect';

import PowerAnalysisPage from './features/power/PowerAnalysisPage';
import { Zap, LogOut, Activity, Sparkles } from 'lucide-react';
import MemberBindingCard from './features/auth/MemberBindingCard';
import PowerDashboard from './features/power/PowerDashboard';
import GoldenCheetahPage from './features/golden-cheetah/GoldenCheetahPage';
import { AICoachPage } from './features/ai-coach/AICoachPage';
import tcuLogo from './assets/tcu-logo.png';

import LandingPage from './features/landing-page/LandingPage';

const SegmentCompare = React.lazy(() => import('./features/segment-compare/SegmentCompare'));

import { TopNav, BottomNav, SidebarNav } from './components/layout/AdaptiveNavigation';

// ... imports

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { athlete, isBound, isMaintenance, logout } = useAuth();

  if (!athlete) {
    return <div className="min-h-screen bg-slate-950">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-tcu-blue/20 pb-16 md:pb-0">
      {/* 伺服器維修橫幅 */}
      {isMaintenance && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-tcu-orange text-white py-2 px-4 shadow-lg animate-in slide-in-from-top duration-300">
          {/* ... banner content ... */}
          <div className="container mx-auto flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-black italic tracking-wider">
              系統公告：後端 API 伺服器連線異常，正在緊急維修中單代... 部分功能可能暫時無法使用。
            </span>
          </div>
        </div>
      )}

      {/* Desktop & Mobile Header (Full Nav on Desktop, Logo only on Mobile maybe? OR use TopNav component logic) */}
      {/* We use TopNav for Desktop (lg+) and Mobile (md-) header structure, but hide nav links on mobile */}
      <div className="hidden lg:block">
        <TopNav athlete={athlete} isBound={isBound} logout={logout} />
      </div>

      {/* Tablet Sidebar (md only) */}
      <SidebarNav athlete={athlete} isBound={isBound} logout={logout} />

      {/* Mobile Header (Simplified) & Bottom Nav */}
      <div className="lg:hidden">
        <header className={`fixed ${isMaintenance ? 'top-9' : 'top-0'} left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-16 flex items-center justify-between px-4`}>
          <RouterLink to="/" className="flex items-center gap-2">
            <img src={tcuLogo} alt="TCU Logo" className="h-8 w-auto" />
            <span className="text-lg font-black italic tracking-tighter uppercase">
              TCU <span className="text-tcu-orange">POWER</span>
            </span>
          </RouterLink>

          <button
            onClick={logout}
            className="p-2 text-slate-400"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        <BottomNav />
      </div>


      <main className="container mx-auto px-4 pt-20 md:pt-6 lg:pt-24 pb-12 flex-1 md:pl-24 lg:pl-4 transition-all">
        {children}
      </main>

      <footer className="py-4 text-center md:pl-20 lg:pl-0">
        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-600 uppercase tracking-wider">
          {import.meta.env.VITE_GIT_HASH || 'v1.2-dev'}
        </span>
      </footer>
    </div>
  );
};

const HomePage: React.FC = () => {
  const { athlete, isBound, isLoading } = useAuth();

  // 未登入狀態
  if (!athlete) {
    return <LandingPage />;
  }

  // 已登入狀態
  return (
    <div className={`mx-auto space-y-8 ${isBound ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div className="grid gap-8">
        {/* TCU 綁定卡片 - 僅在未綁定時顯示，且改為次要提示 */}
        {!isBound && (
          <div className="md:col-span-1">
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Activity className="w-4 h-4" /> 綁定 TCU 會員以解鎖更完整的個人數據與車隊排名！
              </p>
            </div>
            <MemberBindingCard onBindingSuccess={() => { }} />
          </div>
        )}

        {isBound && (
          <div className="md:col-span-1">
            <MemberBindingCard onBindingSuccess={() => { }} />
          </div>
        )}

        {/* 功率分析頁面進入按鈕 - 現在對所有登入使用者開放 */}
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <RouterLink
            to="/analysis"
            className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            <Zap className="w-5 h-5 fill-white" />
            進入功率分析頁面
          </RouterLink>

          <RouterLink
            to="/ai-coach"
            className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            <Sparkles className="w-5 h-5 fill-white" />
            AI 智能教練
          </RouterLink>

          <RouterLink
            to="/goldencheetah"
            className="w-full md:w-auto px-8 py-4 rounded-xl bg-slate-800 text-yellow-400 font-black text-lg shadow-lg border border-yellow-500/20 hover:bg-slate-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            <Zap className="w-5 h-5" />
            GoldenCheetah 看板
          </RouterLink>
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

        {/* Strava 連結狀態 - 移至底部 */}
        {!isBound && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
            <StravaConnect />
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
          <Route path="/goldencheetah" element={<GoldenCheetahPage />} />
          <Route path="/ai-coach" element={<AICoachPage />} />
          <Route
            path="/compare"
            element={
              <React.Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
                <SegmentCompare />
              </React.Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
