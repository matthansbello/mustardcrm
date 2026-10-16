'use client';

import React, { useState } from 'react';
import { Mail, Phone, Building2, Briefcase, Calendar, Check, Copy } from 'lucide-react';
import { Contact, ActivityItem } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { StageBadge } from '@/components/ui/StageBadge';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';

interface ContactDetailPanelProps {
  contact: Contact | null;
  activity: ActivityItem[];
  onClose: () => void;
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-fg-subtle">{label}</p>
        <div className="mt-0.5 break-words text-sm text-fg">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetailPanel({ contact, activity, onClose }: ContactDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  if (!contact) return null;

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
        {(contact.tags || []).map((t) => (
          <span key={t} className="badge badge-neutral">
            {t}
          </span>
        ))}
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
                <dd className="min-w-0 flex-1 break-words text-fg">{String(value)}</dd>
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
