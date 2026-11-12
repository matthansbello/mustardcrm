'use client';

import React, { useState } from 'react';
import { Mail, Phone, Building2, Briefcase, Calendar, Check, Copy, ListPlus, Tag, X } from 'lucide-react';
import { Contact, ActivityItem, ContactList } from '@/types';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { removeContactsFromList, removeTagsFromContacts } from '@/lib/services/lists';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { StageBadge } from '@/components/ui/StageBadge';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';

interface ContactDetailPanelProps {
  contact: Contact | null;
  activity: ActivityItem[];
  lists: ContactList[];
  onClose: () => void;
  onAddToList: (contact: Contact) => void;
  onEditTags: (contact: Contact) => void;
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-subtle">{label}</p>
        <div className="mt-0.5 wrap-break-word text-sm text-fg">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetailPanel({ contact, activity, lists, onClose, onAddToList, onEditTags }: ContactDetailPanelProps) {
  const { organization } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!contact) return null;

  const memberOf = lists.filter((l) => (contact.listIds || []).includes(l.id));

  const remove = async (key: string, action: () => Promise<void>) => {
    setRemoving(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this contact.');
    } finally {
      setRemoving(null);
    }
  };

  const name = `${contact.firstName} ${contact.lastName}`.trim() || contact.email;
  const custom = Object.entries(contact.customFields || {}).filter(([, v]) => v !== null && v !== '');

  const copyEmail = async () => {
    await navigator.clipboard?.writeText(contact.email).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal isOpen={!!contact} onClose={onClose} title="Contact" variant="right">
      <div className="flex items-center gap-3">
        <Avatar name={name} email={contact.email} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-fg">{name}</p>
          <p className="truncate text-sm text-fg-muted">
            {[contact.title, contact.companyName].filter(Boolean).join(' · ') || contact.email}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StageBadge stage={contact.lifecycleStage} />
      </div>

      <div className="mt-4 flex gap-2">
        <a href={`mailto:${contact.email}`} className="btn btn-secondary btn-sm">
          <Mail className="h-4 w-4" />
          Email
        </a>
        <button onClick={copyEmail} className="btn btn-secondary btn-sm">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </div>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle font-sans">Lists &amp; tags</h3>
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Lists">
            {memberOf.map((l) => (
              <span key={l.id} className="badge badge-violet h-6 gap-1 pr-1 text-xs">
                {l.name}
                <button
                  type="button"
                  disabled={removing === `list:${l.id}`}
                  onClick={() =>
                    organization?.id &&
                    remove(`list:${l.id}`, () => removeContactsFromList(organization.id, l.id, [contact.id]))
                  }
                  aria-label={`Remove from ${l.name}`}
                  className="rounded p-0.5 hover:bg-violet-500/20 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => onAddToList(contact)} className="btn btn-ghost btn-sm h-6 px-1.5 text-xs">
              <ListPlus className="h-3.5 w-3.5" />
              {memberOf.length ? 'Add to list' : 'Add to a list'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
            {(contact.tags || []).map((t) => (
              <span key={t} className="badge badge-neutral h-6 gap-1 pr-1 text-xs">
                {t}
                <button
                  type="button"
                  disabled={removing === `tag:${t}`}
                  onClick={() =>
                    organization?.id && remove(`tag:${t}`, () => removeTagsFromContacts(organization.id, [contact.id], [t]))
                  }
                  aria-label={`Remove tag ${t}`}
                  className="rounded p-0.5 hover:bg-surface-3 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => onEditTags(contact)} className="btn btn-ghost btn-sm h-6 px-1.5 text-xs">
              <Tag className="h-3.5 w-3.5" />
              {(contact.tags || []).length ? 'Edit tags' : 'Add tags'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle font-sans">Details</h3>
        <div className="mt-2 divide-y divide-line">
          <Field icon={Mail} label="Email">
            {contact.email}
          </Field>
          {contact.phone && (
            <Field icon={Phone} label="Phone">
              <a href={`tel:${contact.phone}`} className="hover:underline">
                {contact.phone}
              </a>
            </Field>
          )}
          {contact.companyName && (
            <Field icon={Building2} label="Company">
              {contact.companyName}
            </Field>
          )}
          {contact.title && (
            <Field icon={Briefcase} label="Title">
              {contact.title}
            </Field>
          )}
          <Field icon={Calendar} label="Added">
            {new Date(contact.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </Field>
        </div>
      </section>

      {custom.length > 0 && (
        <section className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-fg-subtle font-sans">Other fields</h3>
          <dl className="mt-2 divide-y divide-line">
            {custom.map(([key, value]) => (
              <div key={key} className="flex gap-3 py-2 text-sm">
                <dt className="w-1/3 shrink-0 capitalize text-fg-subtle">{key.replace(/_/g, ' ')}</dt>
                <dd className="min-w-0 flex-1 wrap-break-word text-fg">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-subtle font-sans">Activity</h3>
        <ActivityTimeline items={activity} />
      </section>
    </Modal>
  );
}
