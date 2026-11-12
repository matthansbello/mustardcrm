'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ListPlus, Plus, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { addContactsToList, cleanListName, createList, findListByName, MAX_LIST_NAME } from '@/lib/services/lists';
import type { Contact, ContactList } from '@/types';

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The contacts being added. */
  contacts: Contact[];
  lists: ContactList[];
  onDone: (message: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function AddToListModal({ isOpen, onClose, contacts, lists, onDone }: AddToListModalProps) {
  const { user, organization } = useAuthStore();
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setChosen(new Set());
    setError(null);
  }, [isOpen]);

  const ids = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const term = cleanListName(search).toLowerCase();
  const visible = term ? lists.filter((l) => l.name.toLowerCase().includes(term)) : lists;
  const canCreate = Boolean(term) && !findListByName(lists, search);

  const alreadyIn = (listId: string) => contacts.filter((c) => (c.listIds || []).includes(listId)).length;

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async (extraNewName?: string) => {
    if (!organization?.id || !user) return;
    setSaving(true);
    setError(null);
    try {
      const targets = lists.filter((l) => chosen.has(l.id));
      if (extraNewName) targets.push(await createList(organization.id, extraNewName, user.id));
      for (const list of targets) await addContactsToList(organization.id, list.id, ids);
      const names = targets.map((l) => `“${l.name}”`).join(', ');
      onDone(`Added ${plural(ids.length, 'contact')} to ${names}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the list.');
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter in the search box creates the typed list when nothing else is picked.
    if (!chosen.size && canCreate) save(search);
    else if (chosen.size) save();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      title="Add to list"
      description={`${plural(ids.length, 'contact')} selected`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            form="add-to-list-form"
            disabled={saving || (!chosen.size && !canCreate)}
            className="btn btn-primary"
          >
            {saving
              ? 'Saving…'
              : chosen.size
                ? `Add to ${plural(chosen.size, 'list')}`
                : canCreate
                  ? `Create list and add`
                  : 'Add to list'}
          </button>
        </>
      }
    >
      <form id="add-to-list-form" onSubmit={submit} className="space-y-3">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={MAX_LIST_NAME}
            placeholder={lists.length ? 'Find or create a list…' : 'Name your first list…'}
            aria-label="Find or create a list"
            className="input pl-9"
          />
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Lists">
          {canCreate && (
            <li>
              <button
                type="button"
                onClick={() => save(search)}
                disabled={saving}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2"
              >
                <Plus className="h-4 w-4 shrink-0 text-accent-fg" />
                <span className="min-w-0 flex-1 truncate">
                  Create <span className="font-medium">“{cleanListName(search)}”</span> and add{' '}
                  {plural(ids.length, 'contact')}
                </span>
              </button>
            </li>
          )}
          {visible.map((list) => {
            const isChosen = chosen.has(list.id);
            const inCount = alreadyIn(list.id);
            const allIn = inCount === ids.length;
            return (
              <li key={list.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isChosen}
                  onClick={() => toggle(list.id)}
                  disabled={allIn}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-60 ${
                    isChosen ? 'border-accent/50 bg-accent-soft' : 'border-line hover:bg-surface-2'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChosen || allIn ? 'border-accent bg-accent text-white' : 'border-line-strong'
                    }`}
                  >
                    {(isChosen || allIn) && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg">{list.name}</span>
                  <span className="shrink-0 text-xs text-fg-subtle">
                    {allIn ? 'Already in list' : inCount ? `${inCount} already in` : ''}
                  </span>
                </button>
              </li>
            );
          })}
          {!visible.length && !canCreate && (
            <li className="flex flex-col items-center gap-2 py-8 text-center text-sm text-fg-muted">
              <ListPlus className="h-5 w-5 text-fg-subtle" />
              Type a name to create your first list.
            </li>
          )}
        </ul>
      </form>
    </Modal>
  );
}
