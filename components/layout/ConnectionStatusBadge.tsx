'use client';

import React from 'react';
import { InboxConnectionStatus, MailProvider } from '@/types';

interface ConnectionStatusBadgeProps {
  status: InboxConnectionStatus;
  /** Which mailbox is connected; defaults to Gmail for accounts created before Zoho support. */
  provider?: MailProvider;
  className?: string;
}

const LABEL: Record<MailProvider, string> = { gmail: 'Gmail', zoho: 'Zoho Mail' };

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ status, provider, className = '' }) => {
  const name = LABEL[provider || 'gmail'];
  const v =
    status === 'connected'
      ? { label: `${name} connected`, badge: 'badge-green', dot: 'bg-emerald-400' }
      : status === 'needs_reauth'
        ? { label: `Reconnect ${name}`, badge: 'badge-amber', dot: 'bg-amber-400' }
        : { label: 'No inbox connected', badge: 'badge-neutral', dot: 'bg-fg-subtle' };
  return (
    <span className={`badge ${v.badge} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
};
