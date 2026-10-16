'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Deal, DealStage } from '@/types';
import { updateDealStage } from '@/lib/services/deals';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { DEAL_STAGE_DOT } from '@/components/ui/StageBadge';

gsap.registerPlugin(Flip);

export const DEAL_STAGES: { key: DealStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'replied', label: 'Replied' },
  { key: 'meeting_booked', label: 'Meeting booked' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const money = (n: number) => `$${(n || 0).toLocaleString()}`;

interface KanbanBoardProps {
  deals: Deal[];
  onDealUpdated?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ deals, onDealUpdated }) => {
  const { organization } = useAuthStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const dragDealId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null);

  useEffect(() => {
    if (!boardRef.current || prefersReducedMotion) return;
    const state = Flip.getState(boardRef.current.querySelectorAll('[data-deal-card]'));
    Flip.from(state, { duration: 0.3, ease: 'power2.inOut', absolute: false, simple: true });
  }, [deals, prefersReducedMotion]);

  const moveDeal = async (dealId: string, stage: DealStage) => {
    if (!organization?.id) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    await updateDealStage(organization.id, dealId, stage);
    onDealUpdated?.();
  };

  return (
    <div
      ref={boardRef}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:snap-none lg:px-8"
    >
      {DEAL_STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.key);
        const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
        const isTarget = dropTarget === stage.key;

        return (
          <section
            key={stage.key}
            aria-label={`${stage.label} deals`}
            className={`flex w-[min(18rem,82vw)] shrink-0 snap-start flex-col rounded-xl border bg-surface transition-colors ${
              isTarget ? 'border-accent bg-accent-soft' : 'border-line'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(stage.key);
            }}
            onDragLeave={() => setDropTarget((t) => (t === stage.key ? null : t))}
            onDrop={async (e) => {
              e.preventDefault();
              setDropTarget(null);
              const dealId = e.dataTransfer.getData('text/deal-id') || dragDealId.current;
              if (dealId) await moveDeal(dealId, stage.key);
              dragDealId.current = null;
            }}
          >
            <header className="flex items-center gap-2 px-3 pb-2 pt-3">
              <span className={`h-2 w-2 rounded-full ${DEAL_STAGE_DOT[stage.key]}`} />
              <h2 className="text-sm font-medium font-sans tracking-normal text-fg">{stage.label}</h2>
              <span className="text-xs tabular-nums text-fg-subtle">{stageDeals.length}</span>
              <span className="ml-auto text-xs tabular-nums text-fg-muted">{money(stageValue)}</span>
            </header>

            <div className="flex min-h-[180px] flex-1 flex-col gap-2 px-2 pb-2">
              {stageDeals.map((deal) => (
                <article
                  key={deal.id}
                  data-deal-card
                  draggable
                  onDragStart={(e) => {
                    dragDealId.current = deal.id;
                    e.dataTransfer.setData('text/deal-id', deal.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="cursor-grab rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong active:cursor-grabbing"
                >
                  <p className="text-sm font-medium leading-snug text-fg">{deal.title}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-sm tabular-nums text-fg-muted">{money(deal.value)}</span>
                    <select
                      value={deal.stage}
                      onChange={(e) => moveDeal(deal.id, e.target.value as DealStage)}
                      aria-label={`Move ${deal.title}`}
                      className="h-8 cursor-pointer appearance-none rounded border border-line bg-transparent px-2 text-xs text-fg-muted hover:text-fg focus:border-accent focus:outline-none lg:h-6 lg:border-transparent lg:px-1.5 lg:text-fg-subtle lg:hover:border-line"
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.key === deal.stage ? 'Move to…' : s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}

              {stageDeals.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-3 py-6 text-xs text-fg-subtle">
                  Drag deals here
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};
