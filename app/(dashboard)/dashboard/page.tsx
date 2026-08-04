'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';
import { SequenceReportingTable } from '@/components/analytics/SequenceReportingTable';
import { RepLeaderboard } from '@/components/analytics/RepLeaderboard';
import {
  getAggregatedKpis,
  getSequenceAnalytics,
  getRepLeaderboard,
  DashboardKpis,
  SequenceAnalyticsItem,
  RepPerformanceItem,
} from '@/lib/services/analytics';
import { Mail, Eye, MessageSquare, Calendar, DollarSign, Plus, Send, Zap } from 'lucide-react';

export default function DashboardPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.11,
    yOffset: 48,
    scaleFrom: 0.9,
    blurFrom: 12,
  });
  const { organization } = useAuthStore();

  const [kpis, setKpis] = useState<DashboardKpis>({
    emailsSent: 0,
    openRate: 0,
    replyRate: 0,
    meetingsBooked: 0,
    pipelineValue: 0,
  });

  const [sequences, setSequences] = useState<SequenceAnalyticsItem[]>([]);
  const [reps, setReps] = useState<RepPerformanceItem[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!organization?.id) return;
      const dataKpis = await getAggregatedKpis(organization.id);
      const dataSeq = await getSequenceAnalytics(organization.id);
      const dataReps = await getRepLeaderboard(organization.id);
      setKpis(dataKpis);
      setSequences(dataSeq);
      setReps(dataReps);
    }
    loadData();
  }, [organization?.id]);

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-500/20 via-cyan-500/5 to-transparent pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-cyan-300">Live Dashboard</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white">Outreach Command Center</h1>
          <p className="text-xs text-dark-muted">Real-time aggregated performance across connected Workspace accounts.</p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Link href="/sequences" className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            <span>Launch Sequence</span>
          </Link>
          <Link href="/contacts" className="glass-button px-4 py-2 rounded-xl text-xs font-medium text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contacts</span>
          </Link>
        </div>
      </div>

      {/* Animated KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-dark-muted">Emails Sent</span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/25 to-cyan-500/10 text-blue-300 border border-blue-400/30">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold font-display text-white tracking-tight">
            <AnimatedCounter value={kpis.emailsSent} />
          </h3>
        </div>

        <div className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-dark-muted">Open Rate</span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/25 to-blue-500/10 text-indigo-300 border border-indigo-400/30">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold font-display text-white tracking-tight">
            <AnimatedCounter value={kpis.openRate} suffix="%" decimals={1} />
          </h3>
        </div>

        <div className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-dark-muted">Reply Rate</span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold font-display text-cyan-300 tracking-tight">
            <AnimatedCounter value={kpis.replyRate} suffix="%" decimals={1} />
          </h3>
        </div>

        <div className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-dark-muted">Meetings Booked</span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-blue-400 border border-blue-500/30">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold font-display text-white tracking-tight">
            <AnimatedCounter value={kpis.meetingsBooked} />
          </h3>
        </div>

        <div className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-dark-muted">Pipeline Value</span>
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500/25 to-blue-600/10 text-sky-300 border border-sky-400/30">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold font-display text-white tracking-tight">
            <AnimatedCounter value={kpis.pipelineValue} prefix="$" />
          </h3>
        </div>
      </div>

      {/* Main Grid: Campaign Analytics & Rep Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SequenceReportingTable sequences={sequences} />
        </div>
        <div>
          <RepLeaderboard reps={reps} />
        </div>
      </div>
    </div>
  );
}
