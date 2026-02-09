
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import StravaConnect from './features/auth/StravaConnect';
import { Link as RouterLink } from 'react-router-dom';
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
  const { athlete, isBound } = useAuth();

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

      {athlete && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">
          {!isBound && <MemberBindingCard onBindingSuccess={() => { }} />}

          {/* Enter Dashboard Button */}
          <div className="flex justify-center">
            <RouterLink
              to="/power"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-tcu-blue to-cyan-600 text-white font-bold shadow-lg shadow-tcu-blue/20 hover:scale-105 transition-transform flex items-center gap-2"
            >
              進入功率分析儀表板 →
            </RouterLink>
          </div>
        </div>
      )}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
