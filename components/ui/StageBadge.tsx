import React from 'react';
import type { ContactLifecycleStage, DealStage } from '@/types';

const CONTACT_STAGE: Record<ContactLifecycleStage, string> = {
  lead: 'badge-neutral',
  contacted: 'badge-blue',
  replied: 'badge-violet',
  opportunity: 'badge-amber',
  customer: 'badge-green',
  unsubscribed: 'badge-neutral',
  bounced: 'badge-red',
};

export const DEAL_STAGE_DOT: Record<DealStage, string> = {
  new: 'bg-slate-400',
  contacted: 'bg-blue-400',
  replied: 'bg-violet-400',
  meeting_booked: 'bg-amber-400',
  won: 'bg-emerald-400',
  lost: 'bg-rose-400',
};

export function StageBadge({ stage }: { stage: ContactLifecycleStage }) {
  return <span className={`badge capitalize ${CONTACT_STAGE[stage] || 'badge-neutral'}`}>{stage}</span>;
}
