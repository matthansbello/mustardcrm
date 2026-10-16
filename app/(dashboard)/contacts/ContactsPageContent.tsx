'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Upload, Users } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Contact, ActivityItem, ContactLifecycleStage } from '@/types';
import { subscribeContacts, subscribeContactActivity } from '@/lib/services/contacts';
import { AddContactSlideOver } from '@/components/contacts/AddContactSlideOver';
import { BulkImportModal } from '@/components/importer/BulkImportModal';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ContactDetailPanel } from '@/components/contacts/ContactDetailPanel';
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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Deep links: ?import=1, ?new=1, ?q=term (from the header search)
  useEffect(() => {
    if (searchParams?.get('import') === '1') setIsImportOpen(true);
    if (searchParams?.get('new') === '1') setIsAddOpen(true);
    const q = searchParams?.get('q');
    if (q !== null && q !== undefined) setSearchTerm(q);
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
    if (!organization?.id || !selectedContact) {
      setActivity([]);
      return;
    }
    const unsub = subscribeContactActivity(organization.id, selectedContact.id, setActivity);
    return () => unsub();
  }, [organization?.id, selectedContact?.id]);

  const filtered = useMemo(
    () => (stageFilter === 'all' ? contacts : contacts.filter((c) => c.lifecycleStage === stageFilter)),
    [contacts, stageFilter]
  );

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="Contacts"
        description={
          isLoading
            ? 'Everyone in your shared workspace.'
            : `${contacts.length.toLocaleString()} ${contacts.length === 1 ? 'person' : 'people'} in your shared workspace.`
        }
        actions={
          <>
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
            <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
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
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
                aria-label="Filter by stage"
                className="input h-8 sm:w-44"
              >
                <option value="all">All stages</option>
                {STAGES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <ContactsTable
              contacts={filtered}
              selectedId={selectedContact?.id}
              onSelect={setSelectedContact}
              globalFilter={searchTerm}
            />
          </>
        )}
      </section>

      <ContactDetailPanel contact={selectedContact} activity={activity} onClose={() => setSelectedContact(null)} />

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
      />
    </div>
  );
}
