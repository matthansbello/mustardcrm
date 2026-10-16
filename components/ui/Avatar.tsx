import React from 'react';

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: 'sm' | 'md';
}

// Solid, muted tints picked deterministically from the name so people are easy to tell apart.
const TINTS = [
  'bg-blue-500/15 text-blue-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-amber-500/15 text-amber-300',
  'bg-violet-500/15 text-violet-300',
  'bg-rose-500/15 text-rose-300',
  'bg-cyan-500/15 text-cyan-300',
];

export function initials(name?: string | null, email?: string | null): string {
  const source = (name || '').trim() || (email || '').split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || source.slice(0, 2).toUpperCase();
}

export function Avatar({ name, email, src, size = 'md' }: AvatarProps) {
  const key = (name || email || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const dims = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${dims} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${dims} ${TINTS[key % TINTS.length]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold`}
    >
      {initials(name, email)}
    </span>
  );
}
