'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Eye,
  MessageSquareReply,
  CalendarCheck,
  CircleDollarSign,
  Upload,
  Plus,
  CheckCircle2,
  Circle,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';
import { SequenceReportingTable } from '@/components/analytics/SequenceReportingTable';
import { RepLeaderboard } from '@/components/analytics/RepLeaderboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { InboxConnectModal } from '@/components/auth/InboxConnectModal';
import { countContacts } from '@/lib/services/contacts';
import {
  getAggregatedKpis,
  getSequenceAnalytics,
  getRepLeaderboard,
  DashboardKpis,
  SequenceAnalyticsItem,
  RepPerformanceItem,
} from '@/lib/services/analytics';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

interface Stat {
  label: string;
  icon: LucideIcon;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export default function DashboardPage() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { user, organization, inboxStatus } = useAuthStore();

  const [kpis, setKpis] = useState<DashboardKpis>({
    emailsSent: 0,
    openRate: 0,
    replyRate: 0,
    meetingsBooked: 0,
    pipelineValue: 0,
  });
  const [sequences, setSequences] = useState<SequenceAnalyticsItem[]>([]);
  const [reps, setReps] = useState<RepPerformanceItem[]>([]);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [inboxModalOpen, setInboxModalOpen] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    const orgId = organization.id;
    Promise.all([
      getAggregatedKpis(orgId),
      getSequenceAnalytics(orgId),
      getRepLeaderboard(orgId),
      countContacts(orgId).catch(() => 0),
    ]).then(([k, s, r, c]) => {
      setKpis(k);
      setSequences(s);
      setReps(r);
      setContactCount(c);
    });
  }, [organization?.id]);

  const stats: Stat[] = [
    { label: 'Emails sent', icon: Send, value: kpis.emailsSent },
    { label: 'Open rate', icon: Eye, value: kpis.openRate, suffix: '%', decimals: 1 },
    { label: 'Reply rate', icon: MessageSquareReply, value: kpis.replyRate, suffix: '%', decimals: 1 },
    { label: 'Meetings booked', icon: CalendarCheck, value: kpis.meetingsBooked },
    { label: 'Pipeline value', icon: CircleDollarSign, value: kpis.pipelineValue, prefix: '$' },
  ];

  const setup = [
    {
      done: inboxStatus === 'connected',
      title: 'Connect your Gmail inbox',
      body: 'Sequences are sent from your own address.',
      action: (
        <button onClick={() => setInboxModalOpen(true)} className="btn btn-secondary btn-sm">
          Connect
        </button>
      ),
    },
    {
      done: (contactCount ?? 0) > 0,
      title: 'Add your contacts',
      body: 'Import a CSV or Excel file, or add people one by one.',
      action: (
        <Link href="/contacts?import=1" className="btn btn-secondary btn-sm">
          Import
        </Link>
      ),
    },
    {
      done: sequences.length > 0,
      title: 'Launch your first sequence',
      body: 'Write a few follow-up steps and let Mustard send them.',
      action: (
        <Link href="/sequences?new=1" className="btn btn-secondary btn-sm">
          Create
        </Link>
      ),
    },
  ];
  const completed = setup.filter((s) => s.done).length;
  const showSetup = contactCount !== null && completed < setup.length;

  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description="Here’s how your outreach is performing across the workspace."
        actions={
          <>
            <Link href="/contacts?import=1" className="btn btn-secondary">
              <Upload className="h-4 w-4" />
              Import contacts
            </Link>
            <Link href="/sequences?new=1" className="btn btn-primary">
              <Plus className="h-4 w-4" />
              New sequence
            </Link>
          </>
        }
      />

      {showSetup && (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Get started</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {completed} of {setup.length} done
              </p>
            </div>
            <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-surface-3 sm:block">
              <div className="h-full bg-accent" style={{ width: `${(completed / setup.length) * 100}%` }} />
            </div>
          </div>
          <ol className="divide-y divide-line">
            {setup.map((step) => (
              <li key={step.title} className="flex items-center gap-3 px-5 py-3.5">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={1.75} />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-fg-subtle" strokeWidth={1.75} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? 'text-fg-muted line-through' : 'text-fg'}`}>
                    {step.title}
                  </p>
                  {!step.done && <p className="text-xs text-fg-muted">{step.body}</p>}
                </div>
                {!step.done && step.action}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-surface px-4 py-4 last:col-span-2 sm:px-5 lg:last:col-span-1">
              <div className="flex items-center gap-1.5 text-fg-muted">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold tabular-nums text-fg sm:text-2xl">
                <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SequenceReportingTable sequences={sequences} />
        </div>
        <RepLeaderboard reps={reps} />
      </div>

      {sequences.length > 0 && (
        <Link href="/sequences" className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline">
          View all sequences <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <InboxConnectModal isOpen={inboxModalOpen} onClose={() => setInboxModalOpen(false)} />
    </div>
  );
}
