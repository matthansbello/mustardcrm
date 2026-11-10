'use client';

import React, { useState } from 'react';
import { CircleAlert, Send, MailSearch, Check } from 'lucide-react';
import { startMailboxConnect } from '@/lib/firebase/auth';
import { Modal } from '@/components/ui/Modal';
import type { MailProvider } from '@/types';

interface InboxConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to land after the provider redirects back (default: Settings). */
  returnTo?: string;
  /** Pre-select a provider, e.g. when reconnecting. */
  initialProvider?: MailProvider;
}

const PROVIDERS: { id: MailProvider; name: string; hint: string; logo: React.ReactNode }[] = [
  {
    id: 'gmail',
    name: 'Gmail / Google Workspace',
    hint: 'Personal @gmail.com or your company’s Google Workspace address',
    logo: <GmailLogo />,
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    hint: 'Any mailbox hosted in Zoho Mail, including your own domain',
    logo: <ZohoLogo />,
  },
];

const PERMISSIONS: Record<MailProvider, { send: string; read: string }> = {
  gmail: { send: 'Send email on your behalf', read: 'Reads message headers only, so sequences stop when someone replies.' },
  zoho: { send: 'Create and send messages', read: 'Searches for replies from your contacts, so sequences stop when someone replies.' },
};

export const InboxConnectModal: React.FC<InboxConnectModalProps> = ({
  isOpen,
  onClose,
  returnTo = '/settings?mail=connected',
  initialProvider = 'gmail',
}) => {
  const [provider, setProvider] = useState<MailProvider>(initialProvider);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = PROVIDERS.find((p) => p.id === provider)!;

  const handleAuthorize = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await startMailboxConnect(provider, returnTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect inbox');
      setIsConnecting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect your inbox"
      description="Sequences are sent from your own mailbox, so replies land where you already work."
      locked={isConnecting}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleAuthorize} disabled={isConnecting} className="btn btn-primary">
            {isConnecting ? 'Redirecting…' : `Continue with ${provider === 'zoho' ? 'Zoho' : 'Google'}`}
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

      <fieldset>
        <legend className="label">Where is your email hosted?</legend>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const active = p.id === provider;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  active ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="mail-provider"
                  value={p.id}
                  checked={active}
                  onChange={() => setProvider(p.id)}
                  className="sr-only"
                />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
                  {p.logo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{p.name}</span>
                  <span className="block text-xs text-fg-muted">{p.hint}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-accent-fg" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-5 text-sm text-fg-muted">{selected.name} will ask you to allow:</p>
      <ul className="mt-3 space-y-3">
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
            <Send className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">{PERMISSIONS[provider].send}</p>
            <p className="text-xs text-fg-muted">Only the sequence emails you schedule.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
            <MailSearch className="h-4 w-4 text-fg-muted" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Detect replies</p>
            <p className="text-xs text-fg-muted">{PERMISSIONS[provider].read}</p>
          </div>
        </li>
      </ul>
      <p className="hint mt-4">You can connect one inbox at a time. Connecting a new one replaces the current one.</p>
    </Modal>
  );
};

function GmailLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M1.6 21h3.7v-9L0 8.1v11.3C0 20.3.7 21 1.6 21z" />
      <path fill="#34A853" d="M18.7 21h3.7c.9 0 1.6-.7 1.6-1.6V8.1L18.7 12z" />
      <path fill="#FBBC04" d="M18.7 5.2V12L24 8.1V6c0-2-2.2-3.1-3.8-1.9z" />
      <path fill="#EA4335" d="M5.3 12V5.2l6.7 5 6.7-5V12L12 17z" />
      <path fill="#C5221F" d="M0 6v2.1L5.3 12V5.2L3.8 4.1C2.2 2.9 0 4 0 6z" />
    </svg>
  );
}

function ZohoLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#E42527" />
      <path d="M5 8.5 12 13l7-4.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
