'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { addTagsToContacts, MAX_TAG_LENGTH, removeTagsFromContacts, resolveTags } from '@/lib/services/lists';
import type { Contact } from '@/types';

interface TagContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The contacts being tagged. */
  contacts: Contact[];
  /** Every tag used in the workspace, for suggestions and consistent spelling. */
  allTags: string[];
  onDone: (message: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function TagContactsModal({ isOpen, onClose, contacts, allTags, onDone }: TagContactsModalProps) {
  const { organization } = useAuthStore();
  const [draft, setDraft] = useState('');
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft('');
    setToAdd([]);
    setToRemove(new Set());
    setError(null);
  }, [isOpen]);

  const ids = useMemo(() => contacts.map((c) => c.id), [contacts]);

  /** Tags the selected contacts already have, with how many of them have each. */
  const current = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.forEach((c) => (c.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [contacts]);

  const term = draft.trim().toLowerCase();
  const pending = new Set(toAdd.map((t) => t.toLowerCase()));
  const suggestions = allTags
    .filter((t) => !pending.has(t.toLowerCase()) && (!term || t.toLowerCase().includes(term)))
    // Hide tags every selected contact already has — adding them would do nothing.
    .filter((t) => !current.some(([tag, n]) => tag === t && n === ids.length))
    .slice(0, 8);

  const addDraft = (value = draft) => {
    const next = resolveTags([...toAdd, ...value.split(',')], allTags);
    setToAdd(next);
    setDraft('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault();
      addDraft();
    } else if (e.key === 'Backspace' && !draft && toAdd.length) {
      setToAdd(toAdd.slice(0, -1));
    }
  };

  const toggleRemove = (tag: string) =>
    setToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  // Typed-but-not-entered text counts too, so "Save" never silently drops it.
  const adding = resolveTags([...toAdd, ...draft.split(',')], allTags);
  const removing = [...toRemove].filter((t) => !adding.some((a) => a.toLowerCase() === t.toLowerCase()));
  const hasChanges = adding.length > 0 || removing.length > 0;

  const save = async () => {
    if (!organization?.id || !hasChanges) return;
    setSaving(true);
    setError(null);
    try {
      await addTagsToContacts(organization.id, ids, adding);
      await removeTagsFromContacts(organization.id, ids, removing);
      const parts = [
        adding.length && `added ${adding.map((t) => `“${t}”`).join(', ')}`,
        removing.length && `removed ${removing.map((t) => `“${t}”`).join(', ')}`,
      ].filter(Boolean);
      const sentence = parts.join(' and ');
      onDone(`${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} for ${plural(ids.length, 'contact')}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update tags.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      title={ids.length === 1 ? 'Edit tags' : 'Tag contacts'}
      description={`${plural(ids.length, 'contact')} selected`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !hasChanges} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save tags'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <div className="alert alert-error">{error}</div>}

        <div>
          <label htmlFor="tag-input" className="label">
            Add tags
          </label>
          <div className="input flex h-auto min-h-10 flex-wrap items-center gap-1.5 py-1.5 sm:min-h-9">
            {toAdd.map((t) => (
              <span key={t} className="badge badge-blue h-6 gap-1 pr-1 text-xs">
                {t}
                <button
                  type="button"
                  onClick={() => setToAdd(toAdd.filter((x) => x !== t))}
                  aria-label={`Don’t add ${t}`}
                  className="rounded p-0.5 hover:bg-blue-500/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              // No add-on-blur: it would shift the layout mid-click and swallow a click on
              // "Save tags". Save already includes whatever is still typed in the box.
              maxLength={MAX_TAG_LENGTH * 4}
              placeholder={toAdd.length ? '' : 'e.g. VIP, Webinar 2026'}
              className="min-w-[8rem] flex-1 bg-transparent text-base text-fg outline-hidden placeholder:text-fg-subtle sm:text-sm"
            />
          </div>
          <p className="hint">Press Enter or comma after each tag.</p>

          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Existing tags">
              {suggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addDraft(t)}
                  className="badge badge-neutral h-6 gap-1 text-xs hover:border-line-strong hover:text-fg"
                >
                  <Plus className="h-3 w-3" />
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {current.length > 0 && (
          <div>
            <p className="label">{ids.length === 1 ? 'Current tags' : 'Tags on these contacts'}</p>
            <p className="-mt-1 mb-2 text-xs text-fg-subtle">Click a tag to remove it.</p>
            <div className="flex flex-wrap gap-1.5">
              {current.map(([tag, count]) => {
                const marked = toRemove.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleRemove(tag)}
                    aria-pressed={marked}
                    title={marked ? 'Will be removed — click to keep' : 'Remove this tag'}
                    className={`badge h-6 gap-1 text-xs ${
                      marked ? 'badge-red line-through' : 'badge-neutral hover:border-line-strong hover:text-fg'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                    {ids.length > 1 && <span className="text-fg-subtle no-underline">· {count}</span>}
                    {marked ? null : <X className="h-3 w-3 opacity-60" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
