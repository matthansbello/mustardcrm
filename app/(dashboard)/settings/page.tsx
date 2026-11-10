'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, LogOut } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { disconnectMailbox, MAIL_PROVIDER_LABEL, signOutUser, startMailboxConnect } from '@/lib/firebase/auth';
import { InboxConnectModal } from '@/components/auth/InboxConnectModal';
import { updateOrganization } from '@/lib/services/organization';
import { ConnectionStatusBadge } from '@/components/layout/ConnectionStatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';

const WINDOWS = [
  { value: '9-17', label: '9 am – 5 pm' },
  { value: '8-18', label: '8 am – 6 pm' },
  { value: '7-20', label: '7 am – 8 pm' },
];

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 py-8 md:grid-cols-[280px_1fr] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold font-sans tracking-normal text-fg">{title}</h2>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      </div>
      <div className="card min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function SettingsContent() {
  const containerRef = useGsapReveal<HTMLDivElement>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organization, inboxStatus, setOrganization, setInboxStatus, setUser } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [name, setName] = useState(organization?.name || '');
  const [dailyCap, setDailyCap] = useState(organization?.settings?.defaultDailyCapPerMailbox ?? 50);
  const [sendWindow, setSendWindow] = useState(
    organization?.settings?.defaultSendingWindow
      ? `${organization.settings.defaultSendingWindow.startHour}-${organization.settings.defaultSendingWindow.endHour}`
      : '9-17'
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailNotice, setMailNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const provider = user?.mailProvider || 'gmail';
  const providerName = MAIL_PROVIDER_LABEL[provider];

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setDailyCap(organization.settings?.defaultDailyCapPerMailbox ?? 50);
    const w = organization.settings?.defaultSendingWindow;
    if (w) setSendWindow(`${w.startHour}-${w.endHour}`);
  }, [organization]);

  // Result of the Gmail / Zoho OAuth redirect (?mail= or the older ?gmail=).
  useEffect(() => {
    const result = searchParams?.get('mail') || searchParams?.get('gmail');
    if (!result) return;
    const name = searchParams?.get('provider') === 'zoho' ? 'Zoho Mail' : 'Gmail';
    if (result === 'connected') {
      setInboxStatus('connected');
      setMailNotice({ ok: true, text: `${name} connected. You can now launch sequences.` });
    } else {
      setMailNotice({ ok: false, text: `${name} connection failed: ${searchParams?.get('reason') || 'unknown error'}` });
    }
    router.replace('/settings');
  }, [searchParams, router, setInboxStatus]);

  const windowOptions = WINDOWS.some((w) => w.value === sendWindow)
    ? WINDOWS
    : [...WINDOWS, { value: sendWindow, label: sendWindow.replace('-', ':00 – ') + ':00' }];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !isAdmin) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const [startHour, endHour] = sendWindow.split('-').map(Number);
    const defaultSendingWindow = {
      startHour,
      endHour,
      timezone:
        organization.settings?.defaultSendingWindow?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/New_York',
    };
    try {
      await updateOrganization(organization.id, {
        name: name.trim() || organization.name,
        settings: { defaultDailyCapPerMailbox: dailyCap, defaultSendingWindow },
      });
      setOrganization({
        ...organization,
        name: name.trim() || organization.name,
        settings: { ...organization.settings, defaultDailyCapPerMailbox: dailyCap, defaultSendingWindow },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const reconnect = async () => {
    setConnecting(true);
    try {
      await startMailboxConnect(provider, '/settings?mail=connected');
    } catch (err) {
      setMailNotice({ ok: false, text: err instanceof Error ? err.message : `Could not start ${providerName} connection.` });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${providerName}? Active sequences you send will pause until you connect an inbox again.`)) return;
    setDisconnecting(true);
    try {
      await disconnectMailbox();
      if (user) setUser({ ...user, inboxStatus: 'disconnected', mailProvider: undefined, sendingEmail: undefined });
      setMailNotice({ ok: true, text: `${providerName} disconnected.` });
    } catch (err) {
      setMailNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not disconnect.' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader title="Settings" description="Workspace defaults, your sending inbox and your account." />

      <div className="divide-y divide-line [&>form]:divide-y [&>form]:divide-line">
        <form onSubmit={handleSave} id="workspace-form">
          <Section
            title="Workspace"
            description={
              isAdmin ? 'Shown to everyone in the workspace.' : 'Only admins can change workspace settings.'
            }
          >
            <label htmlFor="ws-name" className="label">
              Workspace name
            </label>
            <input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="input"
            />
          </Section>

          <Section
            title="Sending defaults"
            description="Limits that protect each mailbox’s reputation. New sequences start with these values."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ws-cap" className="label">
                  Daily limit per mailbox
                </label>
                <input
                  id="ws-cap"
                  type="number"
                  min={1}
                  max={500}
                  value={dailyCap}
                  onChange={(e) => setDailyCap(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={!isAdmin}
                  className="input"
                />
                <p className="hint">30–50 is safest for new mailboxes.</p>
              </div>
              <div>
                <label htmlFor="ws-window" className="label">
                  Sending hours
                </label>
                <select
                  id="ws-window"
                  value={sendWindow}
                  onChange={(e) => setSendWindow(e.target.value)}
                  disabled={!isAdmin}
                  className="input"
                >
                  {windowOptions.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  {organization?.settings?.defaultSendingWindow?.timezone ||
                    Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
                {error && <span className="text-sm text-rose-300">{error}</span>}
                {saved && (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </span>
                )}
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </Section>
        </form>

        <Section
          title="Sending inbox"
          description="Sequences are sent from your own Gmail, Google Workspace or Zoho Mail inbox. Replies are detected automatically."
        >
          {mailNotice && (
            <div className={`alert mb-4 ${mailNotice.ok ? 'alert-success' : 'alert-error'}`}>
              {mailNotice.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{mailNotice.text}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <ConnectionStatusBadge status={inboxStatus} provider={user?.mailProvider} />
              {inboxStatus !== 'disconnected' && (
                <span className="min-w-0 break-all text-sm text-fg-muted">{user?.sendingEmail || user?.email}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {inboxStatus === 'disconnected' ? (
                <button onClick={() => setChooserOpen(true)} className="btn btn-primary">
                  Connect inbox
                </button>
              ) : (
                <>
                  <button onClick={reconnect} disabled={connecting} className="btn btn-secondary">
                    {connecting ? 'Redirecting…' : 'Reconnect'}
                  </button>
                  <button onClick={() => setChooserOpen(true)} className="btn btn-secondary">
                    Switch inbox
                  </button>
                  <button onClick={disconnect} disabled={disconnecting} className="btn btn-ghost hover:text-rose-300">
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="hint mt-3">One inbox per person. Connecting a different one replaces the current inbox.</p>
        </Section>

        <InboxConnectModal
          key={String(chooserOpen)}
          isOpen={chooserOpen}
          onClose={() => setChooserOpen(false)}
          returnTo="/settings?mail=connected"
          initialProvider={inboxStatus === 'disconnected' ? 'gmail' : provider === 'zoho' ? 'gmail' : 'zoho'}
        />

        <Section title="Account" description="Your profile comes from the sign-in method you used.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={user?.displayName} email={user?.email} src={user?.photoURL} />
              <div className="min-w-0 break-all">
                <p className="text-sm font-medium text-fg">{user?.displayName}</p>
                <p className="text-xs text-fg-muted">
                  {user?.email} · <span className="capitalize">{user?.role}</span>
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                await signOutUser();
                window.location.href = '/login';
              }}
              className="btn btn-secondary"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <SettingsContent />
    </React.Suspense>
  );
}
