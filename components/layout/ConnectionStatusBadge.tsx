'use client';

import React from 'react';
import { InboxConnectionStatus } from '@/types';

interface ConnectionStatusBadgeProps {
  status: InboxConnectionStatus;
  className?: string;
}

const VARIANTS: Record<InboxConnectionStatus, { label: string; badge: string; dot: string }> = {
  connected: { label: 'Gmail connected', badge: 'badge-green', dot: 'bg-emerald-400' },
  needs_reauth: { label: 'Reconnect Gmail', badge: 'badge-amber', dot: 'bg-amber-400' },
  disconnected: { label: 'Gmail not connected', badge: 'badge-neutral', dot: 'bg-fg-subtle' },
};

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ status, className = '' }) => {
  const v = VARIANTS[status] || VARIANTS.disconnected;
  return (
    <span className={`badge ${v.badge} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
};
