'use client';

import React from 'react';
import { SequenceAnalyticsItem } from '@/lib/services/analytics';
import { BarChart3 } from 'lucide-react';

interface SequenceReportingTableProps {
  sequences: SequenceAnalyticsItem[];
}

export const SequenceReportingTable: React.FC<SequenceReportingTableProps> = ({ sequences }) => {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-mustard-400" />
          <h3 className="text-sm font-bold font-display text-white">Campaign Performance Analytics</h3>
        </div>
        <span className="text-xs text-dark-muted">Updated real-time</span>
      </div>

      {sequences.length === 0 ? (
        <div className="p-8 text-center text-xs text-dark-muted">
          No campaign analytics yet. Launch a cold email sequence to view performance stats here.
        </div>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-dark-muted font-medium uppercase tracking-wider">
            <tr>
              <th className="p-4">Sequence Name</th>
              <th className="p-4">Enrolled</th>
              <th className="p-4">Sent</th>
              <th className="p-4">Open Rate</th>
              <th className="p-4">Reply Rate</th>
              <th className="p-4">Clicks</th>
              <th className="p-4 text-right">Meetings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            {sequences.map((seq) => (
              <tr key={seq.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 font-semibold text-white">{seq.name}</td>
                <td className="p-4 font-mono">{seq.enrolled}</td>
                <td className="p-4 font-mono text-gray-400">{seq.sent}</td>
                <td className="p-4 font-mono font-semibold text-violet-400">{seq.openRate}%</td>
                <td className="p-4 font-mono font-bold text-mustard-400">{seq.replyRate}%</td>
                <td className="p-4 font-mono text-blue-400">{seq.clicked}</td>
                <td className="p-4 text-right font-mono font-bold text-emerald-400">{seq.meetingsBooked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
