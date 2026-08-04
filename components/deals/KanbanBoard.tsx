'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Deal, DealStage } from '@/types';
import { updateDealStage } from '@/lib/services/deals';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

gsap.registerPlugin(Flip);

const STAGES: { key: DealStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'replied', label: 'Replied' },
  { key: 'meeting_booked', label: 'Meeting Booked' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

interface KanbanBoardProps {
  deals: Deal[];
  onDealUpdated?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ deals, onDealUpdated }) => {
  const { organization } = useAuthStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const dragDealId = useRef<string | null>(null);

  useEffect(() => {
    if (!boardRef.current || prefersReducedMotion) return;
    const state = Flip.getState(boardRef.current.querySelectorAll('[data-deal-card]'));
    Flip.from(state, {
      duration: 0.65,
      ease: 'power4.inOut',
      stagger: 0.04,
      absolute: false,
      scale: true,
      simple: true,
    });
  }, [deals, prefersReducedMotion]);

  const moveDeal = async (dealId: string, stage: DealStage) => {
    if (!organization?.id) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;

    await updateDealStage(organization.id, dealId, stage);
    onDealUpdated?.();
  };

  return (
    <div ref={boardRef} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage.key);
        const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

        return (
          <div
            key={stage.key}
            className="glass-panel p-3.5 rounded-2xl border border-white/10 space-y-3 min-w-[210px] flex flex-col min-h-[280px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const dealId = e.dataTransfer.getData('text/deal-id') || dragDealId.current;
              if (dealId) await moveDeal(dealId, stage.key);
              dragDealId.current = null;
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-white font-display">{stage.label}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                {stageDeals.length}
              </span>
            </div>

            <p className="text-[10px] text-dark-muted font-mono font-medium">
              Total: <span className="text-mustard-400 font-bold">${stageValue.toLocaleString()}</span>
            </p>

            <div className="space-y-3 pt-1 flex-1">
              {stageDeals.map((deal) => (
                <div
                  key={deal.id}
                  data-deal-card
                  draggable
                  onDragStart={(e) => {
                    dragDealId.current = deal.id;
                    e.dataTransfer.setData('text/deal-id', deal.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-mustard-500/40 space-y-2.5 transition-all cursor-grab active:cursor-grabbing"
                >
                  <h4 className="text-xs font-bold text-white font-display leading-tight">{deal.title}</h4>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-mustard-400 font-semibold font-mono">
                      ${(deal.value || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {stageDeals.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-[11px] text-gray-500">
                  Drop deals here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
