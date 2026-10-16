'use client';

import React from 'react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { InboxConnectModal } from '../auth/InboxConnectModal';
import { Search, Bell, Plus, ChevronDown, LogOut } from 'lucide-react';
import { signOutUser } from '@/lib/firebase/auth';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, organization, inboxStatus } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOutUser();
    window.location.href = '/login';
  };

  return (
    <header className="h-16 border-b border-blue-500/10 bg-dark-bg/55 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Title / Search area */}
      <div className="flex items-center gap-6">
        <div>
          {title && <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>}
          {subtitle && <p className="text-xs text-dark-muted">{subtitle}</p>}
        </div>

        {/* Global Search Bar Placeholder */}
        <div className="relative hidden md:block w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search contacts, companies, deals..."
            className="w-full bg-blue-500/5 border border-blue-400/15 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-500/40 transition-all"
          />
        </div>
      </div>

      {/* Actions & Profile */}
      <div className="flex items-center gap-4">
        {/* Inbox Connection Indicator (Clickable to manage/reconnect) */}
        <button onClick={() => setIsModalOpen(true)} className="hover:opacity-80 transition-opacity">
          <ConnectionStatusBadge status={inboxStatus} />
        </button>

        {/* Inbox Connection Modal */}
        <InboxConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

        {/* Quick Add Action Button */}
        <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-mustard text-xs">
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Outreach</span>
        </button>

        {/* Notifications */}
        <button className="w-9 h-9 rounded-xl glass-button flex items-center justify-center text-gray-300 hover:text-white relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 shadow-glow-violet" />
        </button>

        {/* User / Workspace Profile */}
        <div className="relative pl-2 border-l border-blue-500/15">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex items-center gap-3 text-left"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-400/30 bg-blue-900/50 flex items-center justify-center font-bold text-xs text-blue-200">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-medium text-white">{user?.displayName || 'Signed in'}</p>
            <p className="text-[10px] text-dark-muted">{organization?.name || 'Workspace'}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden lg:block" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 glass-panel rounded-xl border border-white/10 p-1 shadow-glass">
            <div className="px-3 py-2 text-[11px] text-dark-muted truncate">{user?.email}</div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-200 hover:bg-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
};
