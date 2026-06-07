import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Package, CreditCard,
  Bell, User, LogOut, X, ShieldCheck, MessageSquare,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { logoutUser } from '@/store/authSlice';
import { cn } from '@/utils/helpers';

interface SidebarProps { isOpen: boolean; onClose: () => void; }

const CONVOS_KEY = 'il_conversations';

function getTotalUnread(userId: string): number {
  try {
    const raw = JSON.parse(localStorage.getItem(`${CONVOS_KEY}_${userId}`) || '{}');
    return Object.values(raw).reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
  } catch { return 0; }
}

const userNavItems = [
  { label: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard },
  { label: 'Item Market',  path: '/loans',         icon: Package         },
  { label: 'My Items',     path: '/my-loans',      icon: CreditCard      },
  { label: 'Wallet',        path: '/wallet',        icon: Wallet          },
  { label: 'Messages',      path: '/messages',      icon: MessageSquare   },
  { label: 'Notifications', path: '/notifications', icon: Bell            },
  { label: 'Profile',       path: '/profile',       icon: User            },
];

const adminNavItems = [
  { label: 'Admin Dashboard', path: '/admin',         icon: LayoutDashboard },
  { label: 'Messages',        path: '/messages',      icon: MessageSquare   },
  { label: 'Notifications',   path: '/notifications', icon: Bell            },
  { label: 'Profile',         path: '/profile',       icon: User            },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const userId = user?.id ?? (user as any)?._id ?? '';

  const [unreadMessages, setUnreadMessages] = useState(0);

  // Update unread count instantly via custom event (same-tab) + native storage event
  // (cross-tab) + poll fallback every 2s.
  useEffect(() => {
    if (!userId) return;
    const update = () => setUnreadMessages(getTotalUnread(userId));
    update();
    // Same-tab updates: MessagesPage fires 'il_unread_update' via CustomEvent
    window.addEventListener('il_unread_update', update);
    // Cross-tab updates: native StorageEvent fires when another tab writes localStorage
    window.addEventListener('storage', update);
    // Poll fallback (catches any edge cases missed by events)
    const interval = setInterval(update, 2000);
    return () => {
      window.removeEventListener('il_unread_update', update);
      window.removeEventListener('storage', update);
      clearInterval(interval);
    };
  }, [userId]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <motion.aside
        initial={{ x: -260 }}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-16 bottom-0 w-[260px] bg-white border-r border-gray-200 z-40 lg:translate-x-0 lg:static lg:top-0 lg:h-screen lg:z-0 flex flex-col">

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* User card */}
          {user && (
            <div className="p-4 bg-gradient-to-br from-[#5B6CFF]/5 to-[#3FAF7D]/5 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] flex items-center justify-center text-white font-bold text-lg">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate text-sm">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="font-bold text-[#5B6CFF]">{user.role === 'admin' ? 'Admin' : user.creditScore}</p>
                  <p className="text-gray-400 mt-0.5">{user.role === 'admin' ? 'Role' : 'Trust'}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className={cn('font-bold', user.isKYCVerified ? 'text-[#3FAF7D]' : 'text-yellow-500')}>
                    {user.role === 'admin' ? 'Admin' : (user.isKYCVerified ? 'Verified' : 'Pending')}
                  </p>
                  <p className="text-gray-400 mt-0.5">{user.role === 'admin' ? 'Role' : 'KYC'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menu</p>
            {(user?.role === 'admin' ? adminNavItems : userNavItems).map(item => (
              <NavLink key={item.path} to={item.path} onClick={onClose}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-[#5B6CFF] to-[#5B6CFF]/90 text-white shadow-md shadow-[#5B6CFF]/20'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}>
                {({ isActive }) => (
                  <>
                    <item.icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600')} />
                    <span className="font-medium text-sm">{item.label}</span>
                    {item.path === '/messages' && unreadMessages > 0 && (
                      <span className={cn(
                        'ml-auto text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5',
                        isActive ? 'bg-white text-[#5B6CFF]' : 'bg-[#5B6CFF] text-white'
                      )}>
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {user?.role === 'admin' && (
              <>
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-2">Admin</p>
                <NavLink to="/admin" onClick={onClose}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                    isActive ? 'bg-gradient-to-r from-[#5B6CFF] to-[#5B6CFF]/90 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                  )}>
                  {({ isActive }) => (
                    <>
                      <ShieldCheck className={cn('w-5 h-5', isActive ? 'text-white' : 'text-gray-400')} />
                      <span className="font-medium text-sm">Admin Panel</span>
                    </>
                  )}
                </NavLink>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>

        <button onClick={onClose} className="absolute top-3 right-3 lg:hidden p-1 rounded hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </motion.aside>
    </>
  );
};

export default Sidebar;
