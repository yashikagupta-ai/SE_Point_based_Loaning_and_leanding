import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Menu, Package } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import type { RootState } from '@/store';
import { notificationApi } from '@/services/api';
import { getSocket } from '@/services/socket';

interface HeaderProps { onMenuClick: () => void; }

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useSelector((s: RootState) => s.auth);
  const navigate  = useNavigate();
  const location  = useLocation();
  const [unread, setUnread] = useState(0);

  const currentUserId = user?.id ?? (user as any)?._id ?? '';

  const fetchUnread = useCallback(() => {
    notificationApi.getUnreadCount()
      .then(r => setUnread(r.data.data?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  // Real-time notification badge
  useEffect(() => {
    const socket = getSocket();
    if (currentUserId) socket.emit('register', currentUserId);
    const handler = () => fetchUnread();
    socket.on('notification_update', handler);
    return () => { socket.off('notification_update', handler); };
  }, [currentUserId, fetchUnread]);

  useEffect(() => {
    if (location.pathname === '/notifications') setUnread(0);
  }, [location.pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center px-4 gap-4">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-xl flex items-center justify-center shadow">
          <Package className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900 hidden sm:block">
          Item<span className="text-[#5B6CFF]">Lend</span>
        </span>
      </button>

      <div className="flex-1" />

      <button onClick={() => navigate('/notifications')} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* FIX 6: User name/avatar is now clickable → goes to profile */}
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-gray-100 transition-colors">
        <div className="w-9 h-9 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name}</p>
          <p className="text-xs text-gray-500 capitalize mt-0.5">{user?.tier ?? 'Bronze'}</p>
        </div>
      </button>
    </header>
  );
};

export default Header;
