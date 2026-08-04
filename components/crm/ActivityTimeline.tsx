'use client';

import React from 'react';
import { ActivityItem } from '@/types';
import { Mail, Eye, MousePointer, MessageSquare, UserCheck, StickyNote, Sparkles } from 'lucide-react';

interface ActivityTimelineProps {
  items: ActivityItem[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ items }) => {
  const getEventIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'email_sent':
        return <Mail className="w-3.5 h-3.5 text-mustard-400" />;
      case 'email_opened':
        return <Eye className="w-3.5 h-3.5 text-violet-400" />;
      case 'email_clicked':
        return <MousePointer className="w-3.5 h-3.5 text-blue-400" />;
      case 'email_replied':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'stage_changed':
        return <UserCheck className="w-3.5 h-3.5 text-amber-400" />;
      case 'note_added':
        return <StickyNote className="w-3.5 h-3.5 text-gray-300" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-mustard-400" />;
    }
  };

  return (
    <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
      {items.map((item) => (
        <div key={item.id} className="relative flex items-start gap-4 pl-8">
          <div className="absolute left-0 top-0.5 w-7 h-7 rounded-full bg-dark-card border border-white/10 flex items-center justify-center shadow-glass">
            {getEventIcon(item.type)}
          </div>
          <div className="flex-1 glass-panel p-3 rounded-xl border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-white">{item.title}</h5>
              <span className="text-[10px] text-dark-muted font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {item.description && <p className="text-[11px] text-dark-muted">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};
