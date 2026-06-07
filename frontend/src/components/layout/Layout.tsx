import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useGlobalUnread } from '@/hooks/useGlobalUnread';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useGlobalUnread(); // register socket listener globally so unread badge works on all pages

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex pt-16">
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-[260px]">
            <Sidebar isOpen={true} onClose={() => {}} />
          </div>
        </div>
        <div className="lg:hidden">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
        <main className="flex-1 p-4 lg:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
