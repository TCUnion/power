
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StravaConnect from './features/auth/StravaConnect';

import PowerAnalysisPage from './features/power/PowerAnalysisPage';
import { Link as RouterLink, NavLink } from 'react-router-dom';
import { Zap, LogOut, LayoutDashboard, Activity, ShieldCheck } from 'lucide-react';
import MemberBindingCard from './features/auth/MemberBindingCard';
import PowerDashboard from './features/power/PowerDashboard';
import GoldenCheetahPage from './features/golden-cheetah/GoldenCheetahPage';
import tcuLogo from './assets/tcu-logo.png';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { athlete, isBound, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-tcu-blue/20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* 左側：Logo */}
          <RouterLink to="/" className="flex items-center gap-2 group shrink-0">
            <img src={tcuLogo} alt="TCU Logo" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="text-xl font-black italic tracking-tighter uppercase hidden md:block">
              TCU <span className="text-tcu-orange">POWER</span>
            </span>
          </RouterLink>

          {/* 中間：導航選單 (登入後顯示) */}
          {athlete && (
            <nav className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-full border border-slate-200 dark:border-slate-700/50 absolute left-1/2 -translate-x-1/2 max-w-[60%] overflow-x-auto no-scrollbar">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isActive
                    ? 'bg-white dark:bg-slate-700 text-tcu-orange shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
                  }`
                }
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">會員主頁</span>
              </NavLink>

              <NavLink
                to="/analysis"
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isActive
                    ? 'bg-white dark:bg-slate-700 text-blue-500 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
                  }`
                }
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">功率分析</span>
              </NavLink>

              <NavLink
                to="/goldencheetah"
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isActive
                    ? 'bg-white dark:bg-slate-700 text-yellow-500 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
                  }`
                }
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">GoldenCheetah</span>
              </NavLink>
            </nav>
          )}

          {!athlete && (
            <div className="flex-1 flex justify-center">
              <span className="text-xl font-black italic tracking-tighter uppercase">
                UNLOCK YOUR <span className="text-tcu-orange text-2xl">TCU POWER</span>
              </span>
            </div>
          )}

          {/* 右側：會員狀態與登出 */}
          <div className="flex items-center shrink-0 gap-3">
            {athlete && isBound && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">TCU 認證會員</span>
              </div>
            )}
            {athlete && (
              <button
                onClick={logout}
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center group"
                title="登出"
              >
                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 pt-24 pb-12 flex-1">
        {children}
      </main>
      <footer className="py-4 text-center">
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
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Hero 圖片區塊 */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-slate-700/50">
          <img
            src="/hero-cycling.png"
            alt="Cyclist riding with power data visualization"
            className="w-full h-[340px] sm:h-[420px] object-cover object-center"
          />
          {/* 漸層疊加 */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20" />
          {/* 文字內容 */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tight text-white leading-tight">
              Unlock Your{' '}
              <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                TCU Power
              </span>
            </h1>
            <p className="text-slate-300 font-medium mt-3 text-sm sm:text-base max-w-lg">
              連接 Strava，透過 AI 驅動的功率分析洞察你的騎乘潛力。
            </p>
          </div>
        </div>

        {/* Strava 連接按鈕 */}
        <div className="p-6 bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
          <StravaConnect />
        </div>

        {/* 功能亮點 */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Power Zones</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MMP / CP Model</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
            <div className="text-2xl mb-1">🏋️</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TSS Tracking</div>
          </div>
        </div>
      </div>
    );
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
