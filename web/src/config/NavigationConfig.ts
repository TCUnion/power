import { LayoutDashboard, Zap, Sparkles, Activity, ArrowLeftRight } from 'lucide-react';

export const navigationConfig = [
    {
        path: '/',
        label: '會員主頁',
        icon: LayoutDashboard,
        exact: true
    },
    {
        path: '/analysis',
        label: '功率分析',
        icon: Zap
    },
    {
        path: '/ai-coach',
        label: 'AI 教練',
        icon: Sparkles
    },
    {
        path: '/goldencheetah',
        label: 'GoldenCheetah',
        icon: Activity
    },
    {
        path: '/compare',
        label: '比較',
        icon: ArrowLeftRight
    }
];
