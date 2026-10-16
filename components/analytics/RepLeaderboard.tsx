'use client';

import React from 'react';
import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { RepPerformanceItem } from '@/lib/services/analytics';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';

interface RepLeaderboardProps {
  reps: RepPerformanceItem[];
}

export const RepLeaderboard: React.FC<RepLeaderboardProps> = ({ reps }) => {
  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <h2 className="card-title">Team leaderboard</h2>
        <span className="text-xs text-fg-subtle">By reply rate</span>
      </div>

      {reps.length === 0 ? (
        <EmptyState
          compact
          icon={UsersRound}
          title="No team activity yet"
          description="Invite teammates to compare reply rates and pipeline."
          action={
            <Link href="/team" className="btn btn-secondary btn-sm">
              Invite teammates
            </Link>
          }
        />
      ) : (
        <ol className="divide-y divide-line">
          {reps.slice(0, 5).map((rep, idx) => (
            <li key={rep.userId} className="flex items-center gap-3 px-5 py-3">
              <span className="w-4 text-xs tabular-nums text-fg-subtle">{idx + 1}</span>
              <Avatar name={rep.displayName} email={rep.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{rep.displayName}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {rep.emailsSent.toLocaleString()} sent · ${rep.pipelineValue.toLocaleString()} pipeline
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-fg">{rep.replyRate}%</span>
            </li>
          ))}
        </ol>
      )}
      {reps.length > 5 && (
        <div className="border-t border-line px-5 py-3">
          <Link href="/team" className="text-sm text-accent-fg hover:underline">
            View all {reps.length} teammates
          </Link>
        </div>
      )}
    </section>
  );
};
