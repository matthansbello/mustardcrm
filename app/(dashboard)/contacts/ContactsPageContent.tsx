'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Contact, ActivityItem } from '@/types';
import { subscribeContacts, subscribeContactActivity } from '@/lib/services/contacts';
import { AddContactSlideOver } from '@/components/contacts/AddContactSlideOver';
import { BulkImportModal } from '@/components/importer/BulkImportModal';
import { ContactsTable } from '@/components/contacts/ContactsTable';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { Users, Plus, Upload, Filter, Search } from 'lucide-react';

export default function ContactsPageContent() {
  const containerRef = useGsapReveal<HTMLDivElement>({
    stagger: 0.1,
    yOffset: 48,
    scaleFrom: 0.9,
    blurFrom: 12,
  });
  const { organization } = useAuthStore();
  const searchParams = useSearchParams();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddSlideOverOpen, setIsAddSlideOverOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (searchParams?.get('import') === '1') {
      setIsImportModalOpen(true);
    }
  }, [searchParams]);

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

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Contacts</h1>
          <p className="text-xs text-dark-muted">
            Manage prospect details, lifecycle stages, and bulk imports.
            {!isLoading && (
              <span className="text-mustard-400 ml-2">{contacts.length} contacts</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="glass-button px-3.5 py-2 rounded-xl text-xs font-medium text-white flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV / XLSX</span>
          </button>
          <button
            onClick={() => setIsAddSlideOverOpen(true)}
            className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name, email, or company..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-mustard-500"
          />
        </div>
        <button className="glass-button px-3 py-2 rounded-xl text-xs font-medium text-gray-300 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/10 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-dark-muted">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Users className="w-10 h-10 text-gray-600 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">No contacts in workspace</h3>
                <p className="text-xs text-dark-muted mt-1 max-w-sm mx-auto">
                  Click &quot;Add Contact&quot; or &quot;Import CSV / XLSX&quot; above to start populating your outreach list.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsAddSlideOverOpen(true)}
                  className="btn-mustard px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Add First Contact
                </button>
              </div>
            </div>
          ) : (
            <ContactsTable
              contacts={contacts}
              selectedId={selectedContact?.id}
              onSelect={setSelectedContact}
              globalFilter={searchTerm}
            />
          )}
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h3 className="text-sm font-bold font-display text-white border-b border-white/10 pb-3">
            Activity Stream {selectedContact ? `— ${selectedContact.firstName}` : ''}
          </h3>

          {selectedContact ? (
            <ActivityTimeline items={activity} />
          ) : (
            <div className="p-8 text-center text-xs text-dark-muted">
              Select a contact from the list to view their activity stream.
            </div>
          )}
        </div>
      </div>

      <AddContactSlideOver
        isOpen={isAddSlideOverOpen}
        onClose={() => setIsAddSlideOverOpen(false)}
        onSuccess={() => undefined}
      />

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => undefined}
      />
    </div>
  );
}
