'use client';

import React from 'react';
import { InboxConnectionStatus } from '@/types';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface ConnectionStatusBadgeProps {
  status: InboxConnectionStatus;
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ status, className = '' }) => {
  if (status === 'connected') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Gmail Connected</span>
      </div>
    );
  }

  if (status === 'needs_reauth') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-500/30 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
        <span>Needs Reauth</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-rose-950/60 text-rose-400 border border-rose-500/30 ${className}`}>
      <XCircle className="w-3.5 h-3.5 text-rose-400" />
      <span>Inbox Disconnected</span>
    </div>
  );
};
