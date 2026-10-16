'use client';

import React from 'react';
import Link from 'next/link';
import { Mails } from 'lucide-react';
import { SequenceAnalyticsItem } from '@/lib/services/analytics';
import { EmptyState } from '@/components/ui/EmptyState';

interface SequenceReportingTableProps {
  sequences: SequenceAnalyticsItem[];
}

export const SequenceReportingTable: React.FC<SequenceReportingTableProps> = ({ sequences }) => {
  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <h2 className="card-title">Sequence performance</h2>
      </div>

      {sequences.length === 0 ? (
        <EmptyState
          compact
          icon={Mails}
          title="No sequences yet"
          description="Open, reply and meeting rates will appear here once your first sequence is sending."
          action={
            <Link href="/sequences?new=1" className="btn btn-secondary btn-sm">
              Create a sequence
            </Link>
          }
        />
      ) : (
        <>
        <ul className="divide-y divide-line md:hidden">
          {sequences.map((seq) => (
            <li key={seq.id} className="px-4 py-3">
              <p className="truncate text-sm font-medium text-fg">{seq.name}</p>
              <p className="mt-1 text-xs tabular-nums text-fg-muted">
                {seq.sent} sent · {seq.openRate}% opened ·{' '}
                <span className="text-fg">{seq.replyRate}% replied</span> · {seq.meetingsBooked} meetings
              </p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Sequence</th>
                <th className="text-right">Enrolled</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Opened</th>
                <th className="text-right">Replied</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">Meetings</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => (
                <tr key={seq.id} className="hover:bg-surface-2">
                  <td className="font-medium text-fg">{seq.name}</td>
                  <td className="text-right tabular-nums text-fg-muted">{seq.enrolled}</td>
                  <td className="text-right tabular-nums text-fg-muted">{seq.sent}</td>
                  <td className="text-right tabular-nums text-fg">{seq.openRate}%</td>
                  <td className="text-right tabular-nums font-medium text-fg">{seq.replyRate}%</td>
                  <td className="text-right tabular-nums text-fg-muted">{seq.clicked}</td>
                  <td className="text-right tabular-nums text-fg">{seq.meetingsBooked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
};
