'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Plus, Search } from 'lucide-react';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { LogoMark } from '@/components/brand/Logo';
import { InboxConnectModal } from '../auth/InboxConnectModal';

interface HeaderProps {
  /** Opens the sidebar drawer on small screens. */
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const router = useRouter();
  const { inboxStatus } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like most productivity apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/contacts?q=${encodeURIComponent(q)}` : '/contacts');
    searchRef.current?.blur();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas px-3 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="btn btn-ghost btn-icon btn-sm lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Link href="/dashboard" aria-label="Mustard home" className="shrink-0 lg:hidden">
        <LogoMark size={22} />
      </Link>

      <form onSubmit={handleSearch} className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          aria-label="Search contacts"
          className="input h-9 pl-9 sm:h-8 sm:pr-9"
        />
        <span className="kbd pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</span>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="hidden rounded-md sm:block"
          title="Manage Gmail connection"
        >
          <ConnectionStatusBadge status={inboxStatus} />
        </button>
        <Link href="/contacts?new=1" className="btn btn-primary btn-sm max-sm:w-9 max-sm:px-0" aria-label="New contact">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New contact</span>
        </Link>
      </div>

      <InboxConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </header>
  );
};
