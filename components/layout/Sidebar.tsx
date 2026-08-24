'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  Send,
  UserCheck,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { useMagnetic } from '@/lib/hooks/useMagnetic';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Deals', href: '/deals', icon: Kanban },
  { name: 'Sequences', href: '/sequences', icon: Send },
  { name: 'Team', href: '/team', icon: UserCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const brandRef = useMagnetic<HTMLAnchorElement>(0.2);

  useEffect(() => {
    if (!navRef.current || prefersReducedMotion) return;

    const items = navRef.current.querySelectorAll('[data-nav-item]');
    gsap.fromTo(
      items,
      { opacity: 0, x: -28, filter: 'blur(8px)' },
      {
        opacity: 1,
        x: 0,
        filter: 'blur(0px)',
        duration: 0.65,
        stagger: 0.07,
        ease: 'power4.out',
        clearProps: 'filter,transform',
      }
    );
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const active = navRef.current?.querySelector('[data-nav-active="true"]');
    if (!active) return;
    gsap.fromTo(
      active,
      { scale: 0.96 },
      { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' }
    );
  }, [pathname, prefersReducedMotion]);

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 z-40 bg-dark-bg/70 backdrop-blur-2xl border-r border-blue-500/10 flex flex-col justify-between p-4 select-none">
      <div>
        <Link
          ref={brandRef}
          href="/"
          className="flex items-center gap-3 px-3 py-3 mb-6 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center shadow-glow-blue group-hover:scale-110 transition-transform duration-300">
            <Zap className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-xl tracking-tight text-white">
                Mustard
              </span>
              <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-dark-muted">CRM & Cold Outreach</p>
          </div>
        </Link>

        <nav ref={navRef} className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && !!pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                data-nav-item
                data-nav-active={isActive ? 'true' : 'false'}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-cyan-500/10 text-blue-300 border border-blue-400/30 shadow-glow-mustard'
                    : 'text-gray-400 hover:text-white hover:bg-blue-500/5 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-cyan-300' : 'text-gray-400'
                  }`}
                />
                <span>{item.name}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-glow-violet animate-glow-pulse" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3.5 rounded-xl glass-panel border border-blue-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white">Gmail sending</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Active</span>
        </div>
        <p className="text-[11px] text-dark-muted leading-relaxed">
          Cold email throttle set to 50 sends/day per mailbox.
        </p>
      </div>
    </aside>
  );
};
