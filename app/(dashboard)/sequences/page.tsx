'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mails, Pause, Play, Plus, TriangleAlert } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Sequence, SequenceStatus } from '@/types';
import { getSequences, launchSequence, pauseSequence } from '@/lib/services/sequences';
import { SequenceBuilder } from '@/components/sequences/SequenceBuilder';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_BADGE: Record<SequenceStatus, string> = {
  active: 'badge-green',
  paused: 'badge-amber',
  draft: 'badge-neutral',
  archived: 'badge-neutral',
};

const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');

function timeAgo(iso?: string): string {
  const ms = Date.now() - Date.parse(iso || '');
  if (!Number.isFinite(ms)) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** One line under the sequence name: a delivery problem, or when the last email went out. */
function DeliveryLine({ seq }: { seq: Sequence }) {
  const d = seq.deliveryStatus;
  if (seq.status === 'active' && d?.state === 'error' && d.message) {
    return (
      <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-300">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>Not sending: {d.message}</span>
      </p>
    );
  }
  if (d?.lastSentAt) return <p className="mt-0.5 text-xs text-fg-subtle">Last email sent {timeAgo(d.lastSentAt)}</p>;
  return null;
}

function SequencesContent() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { organization } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(searchParams?.get('new') === '1');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSequences = async () => {
    if (!organization?.id) return;
    const data = await getSequences(organization.id);
    setSequences(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSequences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const closeBuilder = () => {
    setIsBuilding(false);
    if (searchParams?.get('new')) router.replace('/sequences');
    fetchSequences();
  };

  const toggle = async (seq: Sequence) => {
    if (!organization?.id) return;
    setBusyId(seq.id);
    try {
      if (seq.status === 'active') await pauseSequence(organization.id, seq.id);
      else await launchSequence(organization.id, seq.id);
      await fetchSequences();
    } finally {
      setBusyId(null);
    }
  };

  if (isBuilding) {
    return <SequenceBuilder onLaunch={closeBuilder} onCancel={closeBuilder} />;
  }

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="Sequences"
        description="Multi-step email campaigns sent from your own Gmail, stopping automatically when people reply."
        actions={
          <button onClick={() => setIsBuilding(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            New sequence
          </button>
        }
      />

      <section className="card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-16 text-center text-sm text-fg-muted">Loading sequences…</p>
        ) : sequences.length === 0 ? (
          <EmptyState
            icon={Mails}
            title="No sequences yet"
            description="Write an opening email and a few follow-ups. Mustard sends them on schedule and stops when someone replies."
            action={
              <button onClick={() => setIsBuilding(true)} className="btn btn-primary">
                <Plus className="h-4 w-4" />
                Create sequence
              </button>
            }
          />
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {sequences.map((seq) => {
              const s = seq.stats || { enrolled: 0, sent: 0, opened: 0, replied: 0, clicked: 0, bounced: 0 };
              const canToggle = seq.status === 'active' || seq.status === 'paused';
              return (
                <li key={seq.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{seq.name}</p>
                      <p className="mt-0.5 text-xs text-fg-subtle">{(seq.steps || []).length} steps</p>
                      <DeliveryLine seq={seq} />
                    </div>
                    <span className={`badge shrink-0 capitalize ${STATUS_BADGE[seq.status]}`}>{seq.status}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Enrolled', String(s.enrolled)],
                      ['Sent', String(s.sent)],
                      ['Opened', pct(s.opened, s.sent)],
                      ['Replied', pct(s.replied, s.sent)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-surface-2 py-2">
                        <dd className="text-sm font-medium tabular-nums text-fg">{value}</dd>
                        <dt className="text-[11px] text-fg-subtle">{label}</dt>
                      </div>
                    ))}
                  </dl>
                  {canToggle && (
                    <button
                      onClick={() => toggle(seq)}
                      disabled={busyId === seq.id}
                      className="btn btn-secondary btn-sm mt-3 w-full"
                    >
                      {seq.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {seq.status === 'active' ? 'Pause sequence' : 'Resume sequence'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="text-right">Steps</th>
                  <th className="text-right">Enrolled</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Opened</th>
                  <th className="text-right">Replied</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => {
                  const s = seq.stats || { enrolled: 0, sent: 0, opened: 0, replied: 0, clicked: 0, bounced: 0 };
                  const canToggle = seq.status === 'active' || seq.status === 'paused';
                  return (
                    <tr key={seq.id} className="hover:bg-surface-2">
                      <td className="max-w-xs">
                        <p className="font-medium text-fg">{seq.name}</p>
                        <DeliveryLine seq={seq} />
                      </td>
                      <td>
                        <span className={`badge capitalize ${STATUS_BADGE[seq.status]}`}>{seq.status}</span>
                      </td>
                      <td className="text-right tabular-nums text-fg-muted">{(seq.steps || []).length}</td>
                      <td className="text-right tabular-nums text-fg-muted">{s.enrolled}</td>
                      <td className="text-right tabular-nums text-fg-muted">{s.sent}</td>
                      <td className="text-right tabular-nums text-fg">{pct(s.opened, s.sent)}</td>
                      <td className="text-right tabular-nums font-medium text-fg">{pct(s.replied, s.sent)}</td>
                      <td className="text-right">
                        {canToggle && (
                          <button
                            onClick={() => toggle(seq)}
                            disabled={busyId === seq.id}
                            className="btn btn-secondary btn-sm"
                          >
                            {seq.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {seq.status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function SequencesPage() {
  return (
    <React.Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <SequencesContent />
    </React.Suspense>
  );
}
