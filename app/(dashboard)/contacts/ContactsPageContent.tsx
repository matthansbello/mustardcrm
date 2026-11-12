'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ListChecks, ListMinus, ListPlus, Plus, Search, Tag, Upload, Users, X } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Contact, ActivityItem, ContactLifecycleStage, ContactList } from '@/types';
import { subscribeContacts, subscribeContactActivity } from '@/lib/services/contacts';
import { removeContactsFromList, subscribeLists } from '@/lib/services/lists';
import { AddContactSlideOver } from '@/components/contacts/AddContactSlideOver';
import { BulkImportModal } from '@/components/importer/BulkImportModal';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel';
import { AddToListModal } from '@/components/contacts/AddToListModal';
import { TagContactsModal } from '@/components/contacts/TagContactsModal';
import { ManageListsModal } from '@/components/contacts/ManageListsModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

const STAGES: ContactLifecycleStage[] = [
  'lead',
  'contacted',
  'replied',
  'opportunity',
  'customer',
  'unsubscribed',
  'bounced',
];

export default function ContactsPageContent() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const { organization } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('q') || '');
  const [stageFilter, setStageFilter] = useState<'all' | ContactLifecycleStage>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  // Keep only the id, so the detail panel always shows the live contact (e.g. new tags).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [lists, setLists] = useState<ContactList[]>([]);
  const [listFilter, setListFilter] = useState<string>(searchParams?.get('list') || 'all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  /** Which bulk dialog is open, and for which contacts (the selection, or one contact). */
  const [dialog, setDialog] = useState<{ kind: 'list' | 'tag'; ids: string[]; source: 'selection' | 'contact' } | null>(null);
  const [isManageListsOpen, setIsManageListsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Deep links: ?import=1, ?new=1, ?q=term (from the header search)
  useEffect(() => {
    if (searchParams?.get('import') === '1') setIsImportOpen(true);
    if (searchParams?.get('new') === '1') setIsAddOpen(true);
    const q = searchParams?.get('q');
    if (q !== null && q !== undefined) setSearchTerm(q);
    const list = searchParams?.get('list');
    if (list) setListFilter(list);
  }, [searchParams]);

  const clearDeepLink = () => {
    if (searchParams?.get('import') || searchParams?.get('new')) router.replace('/contacts');
  };

  useEffect(() => {
    if (!organization?.id) return;
    setIsLoading(true);
    const unsub = subscribeContacts(
      organization.id,
      (data) => {
        setContacts(data);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsub();
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;
    return subscribeLists(organization.id, setLists);
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id || !selectedId) {
      setActivity([]);
      return;
    }
    const unsub = subscribeContactActivity(organization.id, selectedId, setActivity);
    return () => unsub();
  }, [organization?.id, selectedId]);

  // Success messages fade after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const selectedContact = useMemo(() => contacts.find((c) => c.id === selectedId) || null, [contacts, selectedId]);

  const allTags = useMemo(
    () => [...new Set(contacts.flatMap((c) => c.tags || []))].sort((a, b) => a.localeCompare(b)),
    [contacts]
  );

  const listCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach((c) => (c.listIds || []).forEach((id) => (counts[id] = (counts[id] || 0) + 1)));
    return counts;
  }, [contacts]);

  // A list that was deleted (or a stale ?list= link) falls back to "All lists".
  const activeList = lists.find((l) => l.id === listFilter) || null;
  const effectiveListFilter = activeList ? activeList.id : 'all';
  const effectiveTagFilter = allTags.includes(tagFilter) ? tagFilter : 'all';

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (stageFilter === 'all' || c.lifecycleStage === stageFilter) &&
          (effectiveListFilter === 'all' || (c.listIds || []).includes(effectiveListFilter)) &&
          (effectiveTagFilter === 'all' || (c.tags || []).includes(effectiveTagFilter))
      ),
    [contacts, stageFilter, effectiveListFilter, effectiveTagFilter]
  );

  // Ticked contacts that still exist (a teammate may delete one meanwhile).
  const checkedContacts = useMemo(() => contacts.filter((c) => checkedIds.has(c.id)), [contacts, checkedIds]);

  const setChecked = React.useCallback((ids: string[], checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const clearChecked = () => setCheckedIds(new Set());

  const finishBulk = (message: string) => {
    setNotice(message);
    setBulkError(null);
    // A bulk action clears the selection; editing one contact from its panel leaves it alone.
    const wasBulk = dialog?.source === 'selection';
    if (wasBulk) clearChecked();
  };

  const removeFromActiveList = async (ids: string[]) => {
    if (!organization?.id || !activeList) return;
    setBulkError(null);
    try {
      await removeContactsFromList(organization.id, activeList.id, ids);
      setNotice(`Removed ${ids.length.toLocaleString()} contact${ids.length === 1 ? '' : 's'} from “${activeList.name}”.`);
      setChecked(ids, false);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Could not update the list.');
    }
  };

  const dialogContacts = useMemo(
    () => (dialog ? contacts.filter((c) => dialog.ids.includes(c.id)) : []),
    [contacts, dialog]
  );

  const filtersActive = stageFilter !== 'all' || effectiveListFilter !== 'all' || effectiveTagFilter !== 'all';

  return (
    <div ref={containerRef} className={`space-y-6 ${checkedContacts.length ? 'pb-24' : ''}`}>
      <PageHeader
        title="Contacts"
        description={
          isLoading
            ? 'Everyone in your shared workspace.'
            : `${contacts.length.toLocaleString()} ${contacts.length === 1 ? 'person' : 'people'} in your shared workspace.`
        }
        actions={
          <>
            <button onClick={() => setIsManageListsOpen(true)} className="btn btn-secondary">
              <ListChecks className="h-4 w-4" />
              Lists
              {lists.length > 0 && <span className="text-fg-subtle">{lists.length}</span>}
            </button>
            <button onClick={() => setIsImportOpen(true)} className="btn btn-secondary">
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button onClick={() => setIsAddOpen(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Add contact
            </button>
          </>
        }
      />

      <section className="card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-16 text-center text-sm text-fg-muted">Loading contacts…</p>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Import a CSV or Excel file from your CRM, LinkedIn or Google Contacts — or add someone manually."
            action={
              <>
                <button onClick={() => setIsImportOpen(true)} className="btn btn-primary">
                  <Upload className="h-4 w-4" />
                  Import file
                </button>
                <button onClick={() => setIsAddOpen(true)} className="btn btn-secondary">
                  Add manually
                </button>
              </>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, email, company, tag…"
                  aria-label="Search contacts"
                  className="input h-8 pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
                  aria-label="Filter by stage"
                  className="input h-8 lg:w-40"
                >
                  <option value="all">All stages</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={effectiveListFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  aria-label="Filter by list"
                  className="input h-8 lg:w-44"
                >
                  <option value="all">All lists</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({(listCounts[l.id] || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                <select
                  value={effectiveTagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  aria-label="Filter by tag"
                  className="input col-span-2 h-8 sm:col-span-1 lg:w-40"
                >
                  <option value="all">All tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setStageFilter('all');
                    setListFilter('all');
                    setTagFilter('all');
                  }}
                  className="btn btn-ghost btn-sm self-start lg:self-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
            <ContactsTable
              contacts={filtered}
              selectedId={selectedId}
              onSelect={(c) => setSelectedId(c.id)}
              globalFilter={searchTerm}
              checkedIds={checkedIds}
              onCheckedChange={setChecked}
            />
          </>
        )}
      </section>

      {/* Bottom dock: confirmation messages and bulk actions for ticked contacts */}
      {(notice || checkedContacts.length > 0) && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl space-y-2 lg:left-60">
          {notice && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-surface-2 px-4 py-3 text-sm text-emerald-200 shadow-popover" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{notice}</span>
              <button onClick={() => setNotice(null)} className="text-fg-subtle hover:text-fg" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {checkedContacts.length > 0 && (
            <div role="toolbar" aria-label="Bulk actions" className="rounded-xl border border-line-strong bg-surface-2 p-2 shadow-popover">
              {bulkError && <p className="px-2 pb-2 text-sm text-rose-300">{bulkError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 px-2 text-sm text-fg">
                  <span className="font-semibold">{checkedContacts.length.toLocaleString()}</span> selected
                </p>
                <button
                  onClick={() => setDialog({ kind: 'list', ids: checkedContacts.map((c) => c.id), source: 'selection' })}
                  className="btn btn-primary btn-sm"
                >
                  <ListPlus className="h-4 w-4" />
                  Add to list
                </button>
                <button
                  onClick={() => setDialog({ kind: 'tag', ids: checkedContacts.map((c) => c.id), source: 'selection' })}
                  className="btn btn-secondary btn-sm"
                >
                  <Tag className="h-4 w-4" />
                  Tags
                </button>
                {activeList && checkedContacts.some((c) => (c.listIds || []).includes(activeList.id)) && (
                  <button
                    onClick={() => removeFromActiveList(checkedContacts.map((c) => c.id))}
                    className="btn btn-secondary btn-sm"
                    title={`Remove from “${activeList.name}”`}
                  >
                    <ListMinus className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove from list</span>
                    <span className="sm:hidden">Remove</span>
                  </button>
                )}
                <button onClick={clearChecked} className="btn btn-ghost btn-sm btn-icon" aria-label="Clear selection">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ContactDetailPanel
        contact={selectedContact}
        activity={activity}
        lists={lists}
        onClose={() => setSelectedId(null)}
        onAddToList={(c) => setDialog({ kind: 'list', ids: [c.id], source: 'contact' })}
        onEditTags={(c) => setDialog({ kind: 'tag', ids: [c.id], source: 'contact' })}
      />

      <AddToListModal
        isOpen={dialog?.kind === 'list'}
        onClose={() => setDialog(null)}
        contacts={dialogContacts}
        lists={lists}
        onDone={finishBulk}
      />

      <TagContactsModal
        isOpen={dialog?.kind === 'tag'}
        onClose={() => setDialog(null)}
        contacts={dialogContacts}
        allTags={allTags}
        onDone={finishBulk}
      />

      <ManageListsModal
        isOpen={isManageListsOpen}
        onClose={() => setIsManageListsOpen(false)}
        lists={lists}
        counts={listCounts}
        onOpenList={(id) => {
          setListFilter(id);
          setIsManageListsOpen(false);
        }}
        onDone={setNotice}
      />

      <AddContactSlideOver
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          clearDeepLink();
        }}
        onSuccess={() => undefined}
      />

      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          clearDeepLink();
        }}
        onSuccess={() => undefined}
        lists={lists}
      />
    </div>
  );
}
