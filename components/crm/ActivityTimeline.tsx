'use client';

import React from 'react';
import {
  Send,
  Eye,
  MousePointerClick,
  MessageSquareReply,
  ArrowRightLeft,
  StickyNote,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { ActivityItem } from '@/types';

const ICONS: Record<ActivityItem['type'], { icon: LucideIcon; tint: string }> = {
  email_sent: { icon: Send, tint: 'text-blue-300' },
  email_opened: { icon: Eye, tint: 'text-violet-300' },
  email_clicked: { icon: MousePointerClick, tint: 'text-cyan-300' },
  email_replied: { icon: MessageSquareReply, tint: 'text-emerald-300' },
  stage_changed: { icon: ArrowRightLeft, tint: 'text-amber-300' },
  note_added: { icon: StickyNote, tint: 'text-fg-muted' },
  contact_created: { icon: UserPlus, tint: 'text-fg-muted' },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const ActivityTimeline: React.FC<{ items: ActivityItem[] }> = ({ items }) => {
  if (!items.length) {
    return <p className="text-sm text-fg-muted">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
      {items.map((item) => {
        const { icon: Icon, tint } = ICONS[item.type] || ICONS.note_added;
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
              <Icon className={`h-3.5 w-3.5 ${tint}`} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                <span className="shrink-0 text-xs text-fg-subtle">{when(item.timestamp)}</span>
              </div>
              {item.description && <p className="mt-0.5 text-xs text-fg-muted">{item.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
