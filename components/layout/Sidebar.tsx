'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  SquareKanban,
  Mails,
  UsersRound,
  Settings,
  LogOut,
  ChevronsUpDown,
  X,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { signOutUser } from '@/lib/firebase/auth';
import { Avatar } from '@/components/ui/Avatar';
import { LogoMark } from '@/components/brand/Logo';
import { InboxConnectModal } from '@/components/auth/InboxConnectModal';

const NAV: { label: string; items: { name: string; href: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Contacts', href: '/contacts', icon: Users },
      { name: 'Companies', href: '/companies', icon: Building2 },
      { name: 'Deals', href: '/deals', icon: SquareKanban },
      { name: 'Sequences', href: '/sequences', icon: Mails },
    ],
  },
  {
    label: 'Manage',
    items: [
      { name: 'Team', href: '/team', icon: UsersRound },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  /** Mobile drawer state; the sidebar is always visible from lg up. */
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open = false, onClose }) => {
  const pathname = usePathname();
  const { user, organization, inboxStatus } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOutUser();
    window.location.href = '/login';
  };

  const dailyCap = organization?.settings?.defaultDailyCapPerMailbox ?? 50;

  return (
    <aside
      aria-label="Main navigation"
      className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(18rem,85vw)] flex-col border-r border-line bg-surface transition-transform duration-200 lg:w-60 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line pl-4 pr-2">
        <Link href="/dashboard" onClick={onClose} className="flex min-w-0 flex-1 items-center gap-2.5">
          <LogoMark size={24} />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-semibold text-fg">Mustard</p>
            <p className="truncate text-[11px] text-fg-subtle">{organization?.name || 'Workspace'}</p>
          </div>
        </Link>
        <button onClick={onClose} aria-label="Close navigation" className="btn btn-ghost btn-icon btn-sm lg:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-10 items-center gap-2.5 rounded-md px-2 text-sm transition-colors lg:h-8 ${
                        active ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-accent-fg' : ''}`} strokeWidth={1.75} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Gmail status */}
      <div className="px-3 pb-3">
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-fg">Gmail sending</span>
            <span
              className={`ml-auto h-2 w-2 rounded-full ${
                inboxStatus === 'connected'
                  ? 'bg-emerald-400'
                  : inboxStatus === 'needs_reauth'
                    ? 'bg-amber-400'
                    : 'bg-fg-subtle'
              }`}
            />
          </div>
          {inboxStatus === 'connected' ? (
            <p className="mt-1.5 text-xs text-fg-muted">Up to {dailyCap} emails per day from your inbox.</p>
          ) : (
            <>
              <p className="mt-1.5 text-xs text-fg-muted">
                {inboxStatus === 'needs_reauth'
                  ? 'Google access expired. Reconnect to keep sending.'
                  : 'Connect Gmail to send sequences.'}
              </p>
              <button onClick={() => setInboxModalOpen(true)} className="btn btn-secondary btn-sm mt-2.5 w-full">
                {inboxStatus === 'needs_reauth' ? 'Reconnect Gmail' : 'Connect Gmail'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Account */}
      <div ref={menuRef} className="relative border-t border-line p-2">
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-line bg-surface-2 p-1 shadow-popover">
            <div className="px-2.5 py-2">
              <p className="truncate text-xs text-fg-muted">{user?.email}</p>
              <p className="mt-0.5 text-[11px] capitalize text-fg-subtle">{user?.role}</p>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              href="/settings"
              onClick={() => {
                setMenuOpen(false);
                onClose?.();
              }}
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign out
            </button>
            <div className="my-1 h-px bg-line" />
            <div className="flex gap-3 px-2.5 py-1.5 text-[11px] text-fg-subtle">
              <Link href="/privacy" className="hover:text-fg">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-fg">
                Terms
              </Link>
            </div>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-surface-2"
        >
          <Avatar name={user?.displayName} email={user?.email} src={user?.photoURL} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{user?.displayName || 'Account'}</p>
            <p className="truncate text-[11px] text-fg-subtle">{user?.email}</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        </button>
      </div>

      <InboxConnectModal isOpen={inboxModalOpen} onClose={() => setInboxModalOpen(false)} />
    </aside>
  );
};
