import React from 'react';
import { NavLink, Link as RouterLink } from 'react-router-dom';
import { navigationConfig } from '../../config/NavigationConfig';
import tcuLogo from '../../assets/tcu-logo.png';
import { LogOut, ShieldCheck } from 'lucide-react';

interface AdaptiveNavProps {
    athlete: any;
    isBound: boolean;
    logout: () => void;
}

export const TopNav: React.FC<AdaptiveNavProps> = ({ athlete, isBound, logout }) => {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <RouterLink to="/" className="flex items-center gap-2 group shrink-0">
                    <img src={tcuLogo} alt="TCU Logo" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" />
                    <span className="text-xl font-black italic tracking-tighter uppercase hidden md:block">
                        TCU <span className="text-tcu-orange">POWER</span>
                    </span>
                </RouterLink>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-full border border-slate-200 dark:border-slate-700/50 absolute left-1/2 -translate-x-1/2 max-w-[60%] overflow-x-auto no-scrollbar">
                    {navigationConfig.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.exact}
                            className={({ isActive }) =>
                                `px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isActive
                                    ? 'bg-white dark:bg-slate-700 text-tcu-orange shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/30'
                                }`
                            }
                        >
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Right Side: User Status & Logout */}
                <div className="flex items-center shrink-0 gap-3">
                    {athlete && isBound && (
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">TCU 認證會員</span>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center group"
                        title="登出"
                    >
                        <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export const BottomNav: React.FC = () => {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe">
            <div className="flex justify-around items-center h-16">
                {navigationConfig.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive
                                ? 'text-tcu-orange'
                                : 'text-slate-400 dark:text-slate-500'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export const SidebarNav: React.FC<AdaptiveNavProps> = ({ logout }) => {
    return (
        <aside className="hidden md:flex lg:hidden fixed top-0 bottom-0 left-0 w-20 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 py-6 items-center">
            <RouterLink to="/" className="mb-8 group">
                <img src={tcuLogo} alt="TCU Logo" className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
            </RouterLink>

            <nav className="flex-1 flex flex-col gap-4 w-full px-2">
                {navigationConfig.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
                        className={({ isActive }) =>
                            `p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${isActive
                                ? 'bg-tcu-orange/10 text-tcu-orange'
                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }`
                        }
                        title={item.label}
                    >
                        <item.icon className="w-6 h-6" />
                        {/* <span className="text-[10px] font-medium">{item.label}</span> */}
                    </NavLink>
                ))}
            </nav>

            <button
                onClick={logout}
                className="mt-auto p-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                title="登出"
            >
                <LogOut className="w-6 h-6" />
            </button>
        </aside>
    );
};
