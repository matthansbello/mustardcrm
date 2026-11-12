'use client';

import React, { useEffect, useState } from 'react';
import { Check, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { cleanListName, createList, deleteList, findListByName, MAX_LIST_NAME, renameList } from '@/lib/services/lists';
import type { ContactList } from '@/types';

interface ManageListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: ContactList[];
  /** Number of contacts in each list, by list id. */
  counts: Record<string, number>;
  /** Show a list's contacts on the contacts page. */
  onOpenList: (listId: string) => void;
  onDone: (message: string) => void;
}

export function ManageListsModal({ isOpen, onClose, lists, counts, onOpenList, onDone }: ManageListsModalProps) {
  const { user, organization } = useAuthStore();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNewName('');
    setEditing(null);
    setConfirmDelete(null);
    setError(null);
  }, [isOpen]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !user) return;
    const name = cleanListName(newName);
    if (!name) return;
    if (findListByName(lists, name)) {
      setError(`A list called “${name}” already exists.`);
      return;
    }
    run(async () => {
      await createList(organization.id, name, user.id);
      setNewName('');
      onDone(`Created “${name}”. Select contacts and choose “Add to list” to fill it.`);
    });
  };

  const saveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !editing) return;
    const name = cleanListName(editing.name);
    const clash = findListByName(lists, name);
    if (clash && clash.id !== editing.id) {
      setError(`A list called “${name}” already exists.`);
      return;
    }
    run(async () => {
      await renameList(organization.id, editing.id, name);
      setEditing(null);
    });
  };

  const remove = (list: ContactList) =>
    organization?.id &&
    run(async () => {
      await deleteList(organization.id, list.id);
      setConfirmDelete(null);
      onDone(`Deleted “${list.name}”. Its contacts are still in the workspace.`);
    });

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy} title="Lists" description="Shared with everyone in the workspace." size="md">
      <div className="space-y-4">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={create} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={MAX_LIST_NAME}
            placeholder="New list name, e.g. Q4 webinar"
            aria-label="New list name"
            className="input"
          />
          <button type="submit" disabled={busy || !cleanListName(newName)} className="btn btn-primary shrink-0">
            <Plus className="h-4 w-4" />
            Create
          </button>
        </form>

        {lists.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-10 text-center text-sm text-fg-muted">
            <ListChecks className="h-5 w-5 text-fg-subtle" />
            No lists yet. Create one above, or select contacts and choose “Add to list”.
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {lists.map((list) => {
              const count = counts[list.id] || 0;
              if (editing?.id === list.id) {
                return (
                  <li key={list.id} className="p-2">
                    <form onSubmit={saveRename} className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        maxLength={MAX_LIST_NAME}
                        aria-label="List name"
                        className="input h-8"
                      />
                      <button type="submit" disabled={busy || !cleanListName(editing.name)} className="btn btn-primary btn-sm btn-icon" aria-label="Save name">
                        <Check className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost btn-sm btn-icon" aria-label="Cancel rename">
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                );
              }
              if (confirmDelete === list.id) {
                return (
                  <li key={list.id} className="flex flex-col gap-2 bg-rose-500/5 p-3 sm:flex-row sm:items-center">
                    <p className="min-w-0 flex-1 text-sm text-fg">
                      Delete <span className="font-medium">“{list.name}”</span>? The {count.toLocaleString()} contact
                      {count === 1 ? '' : 's'} in it stay in the workspace.
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className="btn btn-secondary btn-sm">
                        Cancel
                      </button>
                      <button type="button" onClick={() => remove(list)} disabled={busy} className="btn btn-danger btn-sm">
                        {busy ? 'Deleting…' : 'Delete list'}
                      </button>
                    </div>
                  </li>
                );
              }
              return (
                <li key={list.id} className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenList(list.id)}
                    className="min-w-0 flex-1 text-left"
                    title="Show these contacts"
                  >
                    <p className="truncate text-sm font-medium text-fg hover:underline">{list.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {count.toLocaleString()} contact{count === 1 ? '' : 's'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: list.id, name: list.name })}
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={`Rename ${list.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(list.id)}
                    className="btn btn-ghost btn-sm btn-icon hover:text-rose-300"
                    aria-label={`Delete ${list.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
