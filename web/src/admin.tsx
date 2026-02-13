import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AdminAuthProvider as AuthProvider, useAdminAuth as useAuth } from './contexts/AdminAuthContext';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import './index.css';

// 權限保護路由
const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

    // 1. 未登入 -> 去登入頁
    if (!user) {
        return <Navigate to="/admin.html/login" replace />;
    }

    // 2. 已登入但不是 service@tsu.com.tw -> 顯示無權限
    if (user.email !== 'service@tsu.com.tw') {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <h1 className="text-2xl font-bold text-red-500">無存取權限</h1>
                <p>此區域僅限 service@tsu.com.tw 存取。</p>
                <p>當前登入：{user.email}</p>
                <button
                    onClick={() => window.location.href = '/admin.html/login'}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    切換帳號
                </button>
            </div>
        );
    }

    return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/admin.html/login" element={<AdminLogin />} />
                    <Route
                        path="/admin.html"
                        element={
                            <ProtectedAdminRoute>
                                <AdminDashboard />
                            </ProtectedAdminRoute>
                        }
                    />
                    {/* Fallback all routes to admin dashboard (which is protected) */}
                    <Route path="/admin.html/*" element={<Navigate to="/admin.html" replace />} />

                    {/* Catch all other paths to admin login */}
                    <Route path="*" element={<Navigate to="/admin.html/login" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster position="top-center" />
        </AuthProvider>
    </React.StrictMode>,
);
