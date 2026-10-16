'use client';

import React, { useEffect, useState } from 'react';
import { CircleAlert, Plus } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Deal, DealStage } from '@/types';
import { getDeals, createDeal } from '@/lib/services/deals';
import { KanbanBoard, DEAL_STAGES } from '@/components/deals/KanbanBoard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';

const EMPTY = { title: '', value: '', stage: 'new' as DealStage };

export default function DealsPage() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { user, organization } = useAuthStore();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = async () => {
    if (!organization?.id) return;
    const data = await getDeals(organization.id);
    setDeals(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const openValue = open.reduce((sum, d) => sum + (d.value || 0), 0);

  const closeModal = () => {
    setIsAddOpen(false);
    setError(null);
    setForm(EMPTY);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !organization?.id) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createDeal(organization.id, {
        title: form.title.trim(),
        value: Number(form.value) || 0,
        contactId: 'c_unlinked',
        stage: form.stage,
        ownerId: user?.id || 'unassigned',
      });
      setDeals((prev) => [...prev, created]);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save deal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="Deals"
        description={
          isLoading
            ? 'Your sales pipeline.'
            : `${open.length} open ${open.length === 1 ? 'deal' : 'deals'} worth $${openValue.toLocaleString()}. Drag cards between stages.`
        }
        actions={
          <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            New deal
          </button>
        }
      />

      {isLoading ? (
        <div className="card px-5 py-16 text-center text-sm text-fg-muted">Loading pipeline…</div>
      ) : (
        <KanbanBoard deals={deals} onDealUpdated={fetchDeals} />
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={closeModal}
        locked={saving}
        title="New deal"
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="new-deal-form" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Create deal'}
            </button>
          </>
        }
      >
        {error && (
          <div className="alert alert-error mb-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form id="new-deal-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="deal-title" className="label">
              Deal name <span className="text-rose-400">*</span>
            </label>
            <input
              id="deal-title"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Acme — annual plan"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="deal-value" className="label">
                Value (USD)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">$</span>
                <input
                  id="deal-value"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="10,000"
                  className="input pl-7"
                />
              </div>
            </div>
            <div>
              <label htmlFor="deal-stage" className="label">
                Stage
              </label>
              <select
                id="deal-stage"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })}
                className="input"
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
