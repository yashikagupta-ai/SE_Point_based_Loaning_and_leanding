import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { notificationApi } from '@/services/api';
import { formatRelativeTime, cn } from '@/utils/helpers';
import { getSocket } from '@/services/socket';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcon: Record<string, string> = {
  borrow_request:   '📦',
  borrow_approved:  '✅',
  borrow_rejected:  '❌',
  item_returned:    '📬',
  loan_approved:    '✅',
  loan_repayment:   '💰',
  loan_overdue:     '⚠️',
  negotiate_request:'💬',
  badge_earned:     '🏅',
  system:           'ℹ️',
};

const NotificationsPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const currentUserId = user?.id ?? (user as any)?._id ?? '';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [toast, setToast]                 = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const reload = () => {
    setLoading(true);
    notificationApi.getAll()
      .then(r => setNotifications(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const reloadCb = useCallback(() => reload(), []);
  useEffect(() => {
    reload();
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);
    socket.on('notification_update', reloadCb);
    return () => { socket.off('notification_update', reloadCb); };
  }, [currentUserId, reloadCb]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(ns => ns.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
      showToast('All notifications marked as read');
    } catch {}
  };

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="fixed top-20 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-lg">
            {toast}
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unread > 0 && <p className="text-gray-500 text-sm mt-0.5">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-10 h-10 border-4 border-[#5B6CFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map(n => (
              <motion.div key={n._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className={cn('bg-white rounded-2xl p-4 border flex items-start gap-4 transition-all',
                  n.isRead ? 'border-gray-100' : 'border-[#5B6CFF]/20 bg-blue-50/30')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
                  n.isRead ? 'bg-gray-100' : 'bg-[#5B6CFF]/10')}>
                  {typeIcon[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  {n.title && <p className="font-semibold text-gray-900 text-sm">{n.title}</p>}
                  <p className={cn('text-sm mt-0.5', n.isRead ? 'text-gray-500' : 'text-gray-800')}>{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => handleMarkRead(n._id)}
                    className="flex-shrink-0 text-xs text-[#5B6CFF] hover:underline font-medium whitespace-nowrap">
                    Mark read
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-16 border border-gray-100 text-center">
            <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">You're all caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No notifications to show</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
