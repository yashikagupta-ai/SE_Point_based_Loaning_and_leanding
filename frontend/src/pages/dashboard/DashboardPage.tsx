import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Wallet, Package, TrendingUp, Bell, ChevronRight, AlertTriangle } from 'lucide-react';
import type { RootState } from '@/store';
import { walletApi, itemApi, notificationApi } from '@/services/api';
import Layout from '@/components/layout/Layout';
import StatsCard from '@/components/cards/StatsCard';
import { formatRelativeTime, cn } from '@/utils/helpers';
import { getSocket } from '@/services/socket';
import type { Notification } from '@/types';

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item      = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const [walletBalance,     setWalletBalance]     = useState(0);
  const [availableBalance,  setAvailableBalance]  = useState(0);
  const [activeItems,       setActiveItems]       = useState(0);
  const [pendingCount,      setPendingCount]      = useState(0);
  const [borrowingItems,    setBorrowingItems]    = useState(0);
  const [notifications,     setNotifications]     = useState<Notification[]>([]);
  const [loading,           setLoading]           = useState(true);

  const currentUserId = user?.id ?? (user as any)?._id ?? '';

  const fetchData = useCallback(() => {
    Promise.all([
      walletApi.getWallet().then(r => {
        const w = r.data.data?.wallet ?? r.data.data;
        setWalletBalance(w?.balance ?? 0);
        setAvailableBalance(w?.availableBalance ?? w?.balance ?? 0);
      }),
      itemApi.getListings({ mine: true } as any).then(r => {
        const items: any[] = r.data.data || [];
        setActiveItems(items.filter((i: any) => i.status === 'borrowed').length);
        const pending = items.reduce((sum: number, i: any) =>
          sum + (i.borrowRequests || []).filter((r: any) => r.status === 'pending').length, 0);
        setPendingCount(pending);
      }),
      itemApi.getListings({ borrowedByMe: true } as any).then(r => {
        const items: any[] = r.data.data || [];
        setBorrowingItems(items.length);
      }),
      notificationApi.getAll().then(r => setNotifications((r.data.data || []).slice(0, 5))),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Redirect admins directly to the admin panel
    if (user?.role === 'admin') { navigate('/admin', { replace: true }); return; }
    fetchData();

    // Real-time socket listeners
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);

    const onWalletUpdate = () => {
      walletApi.getWallet().then(r => {
        const w = r.data.data?.wallet ?? r.data.data;
        setWalletBalance(w?.balance ?? 0);
        setAvailableBalance(w?.availableBalance ?? w?.balance ?? 0);
      }).catch(() => {});
    };

    const onNotificationUpdate = () => {
      notificationApi.getAll().then(r => setNotifications((r.data.data || []).slice(0, 5))).catch(() => {});
    };

    const onMyItemsUpdate = () => {
      itemApi.getListings({ mine: true } as any).then(r => {
        const items: any[] = r.data.data || [];
        setActiveItems(items.filter((i: any) => i.status === 'borrowed').length);
        const pending = items.reduce((sum: number, i: any) =>
          sum + (i.borrowRequests || []).filter((r: any) => r.status === 'pending').length, 0);
        setPendingCount(pending);
      }).catch(() => {});
      itemApi.getListings({ borrowedByMe: true } as any).then(r => {
        setBorrowingItems((r.data.data || []).length);
      }).catch(() => {});
    };

    socket.on('wallet_update', onWalletUpdate);
    socket.on('notification_update', onNotificationUpdate);
    socket.on('myitems_update', onMyItemsUpdate);

    return () => {
      socket.off('wallet_update', onWalletUpdate);
      socket.off('notification_update', onNotificationUpdate);
      socket.off('myitems_update', onMyItemsUpdate);
    };
  }, [fetchData, currentUserId]);

  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div variants={container} initial="hidden" animate="visible" className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-gray-500 mt-1">Your item lending & borrowing overview</p>
          </div>
          <button onClick={() => navigate('/loans')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#5B6CFF] text-white rounded-xl text-sm font-medium hover:bg-[#4a5be0] transition-colors">
            Browse Items <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Point Balance"      value={`${walletBalance} pts`}  subtitle={`${availableBalance} pts available`} icon={Wallet}    color="blue"   onClick={() => navigate('/wallet')}       />
          <StatsCard title="Items Lent Out"     value={activeItems}             subtitle={`${pendingCount} pending requests`}  icon={Package}   color="green"  onClick={() => navigate('/my-loans')}     />
          <StatsCard title="Trust Score"        value={user?.creditScore ?? 0}  subtitle={`Tier: ${user?.tier ?? 'Bronze'}`}   icon={TrendingUp} color="purple" onClick={() => navigate('/profile')}     />
          <StatsCard title="Notifications"      value={unread}                  subtitle="unread"                              icon={Bell}      color="orange" onClick={() => navigate('/notifications')} />
        </motion.div>

        {/* KYC Banner */}
        {!user?.isKYCVerified && (
          <motion.div variants={item}
            className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-800">KYC Verification Required</p>
              <p className="text-sm text-yellow-700">Upload your ID on the Profile page to unlock borrow requests.</p>
            </div>
            <button onClick={() => navigate('/profile')}
              className="text-sm text-yellow-800 font-semibold bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Verify Now
            </button>
          </motion.div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active items summary — all cards are clickable */}
          <motion.div variants={item} className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">My Items</h2>
              <button onClick={() => navigate('/my-loans')}
                className="text-sm text-[#5B6CFF] font-medium flex items-center gap-1 hover:underline">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/my-loans')}
                className="bg-white rounded-2xl p-5 border border-gray-100 text-center hover:border-[#5B6CFF]/30 hover:shadow-md transition-all cursor-pointer">
                <p className="text-3xl font-bold text-[#5B6CFF]">{activeItems}</p>
                <p className="text-sm text-gray-500 mt-1">Items I'm Lending</p>
              </button>
              <button
                onClick={() => navigate('/my-loans')}
                className="bg-white rounded-2xl p-5 border border-gray-100 text-center hover:border-[#3FAF7D]/30 hover:shadow-md transition-all cursor-pointer">
                <p className="text-3xl font-bold text-[#3FAF7D]">{borrowingItems}</p>
                <p className="text-sm text-gray-500 mt-1">Items I'm Borrowing</p>
              </button>
              <button
                onClick={() => navigate('/my-loans')}
                className="bg-white rounded-2xl p-5 border border-gray-100 text-center hover:border-orange-300 hover:shadow-md transition-all cursor-pointer">
                <p className="text-3xl font-bold text-orange-500">{pendingCount}</p>
                <p className="text-sm text-gray-500 mt-1">Pending Requests</p>
              </button>
            </div>
            <div className="flex gap-3 justify-center py-2">
              <button onClick={() => navigate('/loans')}
                className="text-sm text-[#5B6CFF] font-medium hover:underline">
                Browse Market →
              </button>
              <button onClick={() => navigate('/my-loans')}
                className="text-sm text-[#3FAF7D] font-medium hover:underline">
                My Listings →
              </button>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
              {unread > 0 && (
                <span className="text-xs font-bold px-2 py-1 bg-[#5B6CFF] text-white rounded-full">{unread}</span>
              )}
            </div>
            <div className="space-y-3">
              {notifications.length > 0 ? notifications.map(n => (
                <div key={n._id}
                  className={cn('p-3 rounded-xl flex items-start gap-3',
                    n.isRead ? 'bg-white border border-gray-100' : 'bg-blue-50 border border-blue-100')}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    n.isRead ? 'bg-gray-100' : 'bg-[#5B6CFF]')}>
                    <Bell className={cn('w-4 h-4', n.isRead ? 'text-gray-400' : 'text-white')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', n.isRead ? 'text-gray-600' : 'font-medium text-gray-900')}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 bg-[#5B6CFF] rounded-full mt-1 flex-shrink-0" />}
                </div>
              )) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
                  <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No notifications yet</p>
                </div>
              )}
              <button onClick={() => navigate('/notifications')}
                className="w-full text-sm text-center text-[#5B6CFF] hover:underline font-medium py-1">
                View all →
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default DashboardPage;
