import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { fetchCurrentUser } from '@/store/authSlice';

import LoginPage from '@/pages/login/LoginPage';
import RegisterPage from '@/pages/register/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import LoansPage from '@/pages/loans/LoansPage';
import MyLoansPage from '@/pages/loans/MyLoansPage';
import WalletPage from '@/pages/wallet/WalletPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import MessagesPage from '@/pages/messages/MessagesPage';
import AdminPage from '@/pages/admin/AdminPage';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
    <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { isAuthenticated, isLoading, user } = useSelector((s: RootState) => s.auth);
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useSelector((s: RootState) => s.auth);
  if (isLoading) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    if (localStorage.getItem('token')) dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard"     element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/loans"         element={<ProtectedRoute><LoansPage /></ProtectedRoute>} />
        <Route path="/my-loans"      element={<ProtectedRoute><MyLoansPage /></ProtectedRoute>} />
        <Route path="/wallet"        element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/profile"       element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/messages"      element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/admin"         element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
