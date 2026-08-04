'use client';

import React from 'react';
import { RepPerformanceItem } from '@/lib/services/analytics';
import { ConnectionStatusBadge } from '@/components/layout/ConnectionStatusBadge';
import { Trophy, Award } from 'lucide-react';

interface RepLeaderboardProps {
  reps: RepPerformanceItem[];
}

export const RepLeaderboard: React.FC<RepLeaderboardProps> = ({ reps }) => {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-mustard-400" />
          <h3 className="text-sm font-bold font-display text-white">Sales Rep Leaderboard</h3>
        </div>
        <span className="text-xs text-dark-muted font-mono">Ranked by Reply Rate</span>
      </div>

      {reps.length === 0 ? (
        <div className="p-8 text-center text-xs text-dark-muted">
          No team performance data yet. Invite sales reps to track leaderboard metrics.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {reps.map((rep, idx) => (
            <div key={rep.userId} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                  idx === 0 ? 'bg-blue-500 text-white shadow-glow-blue' : 'bg-white/10 text-gray-300'
                }`}>
                  {idx + 1}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{rep.displayName}</span>
                    {idx === 0 && <Award className="w-3.5 h-3.5 text-mustard-400" />}
                  </h4>
                  <p className="text-[11px] text-dark-muted font-mono">{rep.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div className="text-right">
                  <p className="text-dark-muted text-[10px]">Reply Rate</p>
                  <p className="font-bold text-mustard-400 font-mono">{rep.replyRate}%</p>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="text-dark-muted text-[10px]">Pipeline Value</p>
                  <p className="font-bold text-white font-mono">${rep.pipelineValue.toLocaleString()}</p>
                </div>

                <div className="hidden md:block">
                  <ConnectionStatusBadge status={rep.inboxStatus} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
