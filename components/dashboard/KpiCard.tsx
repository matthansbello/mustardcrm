'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  accentColor?: 'mustard' | 'violet' | 'emerald' | 'blue';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  accentColor = 'mustard',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = cardRef.current;
    if (!el || prefersReducedMotion) return;

    const onEnter = () => {
      gsap.to(el, {
        y: -6,
        scale: 1.03,
        duration: 0.35,
        ease: 'power3.out',
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: 'elastic.out(1, 0.45)',
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [prefersReducedMotion]);

  const getAccentStyles = () => {
    switch (accentColor) {
      case 'violet':
        return 'from-indigo-500/25 to-cyan-500/10 text-indigo-300 border-indigo-400/30';
      case 'emerald':
        return 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30';
      case 'blue':
        return 'from-blue-500/25 to-cyan-500/10 text-blue-300 border-blue-400/30';
      default:
        return 'from-blue-500/25 to-sky-500/10 text-blue-300 border-blue-400/30';
    }
  };

  return (
    <div
      ref={cardRef}
      className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group will-change-transform"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-cyan-400/20 transition-all duration-500" />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-dark-muted">{title}</span>
        <div className={`p-2 rounded-xl bg-gradient-to-br border ${getAccentStyles()}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-2xl font-bold font-display text-white tracking-tight">{value}</h3>
        {change && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
};
