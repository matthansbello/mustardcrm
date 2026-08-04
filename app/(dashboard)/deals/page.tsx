'use client';

import React, { useState, useEffect } from 'react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Deal } from '@/types';
import { getDeals, createDeal } from '@/lib/services/deals';
import { KanbanBoard } from '@/components/deals/KanbanBoard';
import { Plus, Kanban, X } from 'lucide-react';

export default function DealsPage() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.1,
    yOffset: 48,
    scaleFrom: 0.9,
    blurFrom: 12,
  });
  const { user, organization } = useAuthStore();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newDeal, setNewDeal] = useState({
    title: '',
    value: 10000,
    contactId: '',
  });

  const fetchDeals = async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    const data = await getDeals(organization.id);
    setDeals(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, [organization?.id]);

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.title || !organization?.id) return;

    try {
      const created = await createDeal(organization.id, {
        title: newDeal.title,
        value: Number(newDeal.value) || 0,
        contactId: newDeal.contactId || 'c_unlinked',
        stage: 'new',
        ownerId: user?.id || user?.email || 'unassigned',
      });

      setDeals((prev) => [...prev, created]);
      setNewDeal({ title: '', value: 10000, contactId: '' });
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to create deal:', err);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Deal Pipeline</h1>
          <p className="text-xs text-dark-muted">Kanban board automatically moving stages on prospect email replies.</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Deal</span>
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center text-xs text-dark-muted">
          Loading pipeline deals...
        </div>
      ) : (
        <KanbanBoard deals={deals} onDealUpdated={fetchDeals} />
      )}

      {/* New Deal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/10 space-y-6 relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute right-4 top-4 text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
                <Kanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-white">Create New Deal</h3>
                <p className="text-xs text-dark-muted">Add a deal opportunity to your pipeline</p>
              </div>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Deal Title *</label>
                <input
                  type="text"
                  required
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  placeholder="Acme Enterprise License"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-300">Deal Value ($)</label>
                <input
                  type="number"
                  required
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="glass-button px-4 py-2 rounded-xl text-xs font-medium text-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-mustard px-5 py-2 rounded-xl text-xs font-semibold">
                  Save Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
