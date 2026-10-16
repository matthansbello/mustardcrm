'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, LogOut } from 'lucide-react';
import { useGsapReveal } from '@/lib/hooks/useGsapReveal';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { signOutUser, startGmailConnect } from '@/lib/firebase/auth';
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
  const { user, organization, inboxStatus, setOrganization, setInboxStatus } = useAuthStore();
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
  const [gmailNotice, setGmailNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setDailyCap(organization.settings?.defaultDailyCapPerMailbox ?? 50);
    const w = organization.settings?.defaultSendingWindow;
    if (w) setSendWindow(`${w.startHour}-${w.endHour}`);
  }, [organization]);

  // Result of the Gmail OAuth redirect.
  useEffect(() => {
    const gmail = searchParams?.get('gmail');
    if (!gmail) return;
    if (gmail === 'connected') {
      setInboxStatus('connected');
      setGmailNotice({ ok: true, text: 'Gmail connected. You can now launch sequences.' });
    } else {
      setGmailNotice({ ok: false, text: `Gmail connection failed: ${searchParams?.get('reason') || 'unknown error'}` });
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

  const connectGmail = async () => {
    setConnecting(true);
    try {
      await startGmailConnect('/settings?gmail=connected');
    } catch (err) {
      setGmailNotice({ ok: false, text: err instanceof Error ? err.message : 'Could not start Gmail connection.' });
      setConnecting(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader title="Settings" description="Workspace defaults, your Gmail connection and your account." />

      <div className="-mt-2 divide-y divide-line [&>form]:divide-y [&>form]:divide-line">
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

        <Section title="Gmail" description="Sequences are sent from your own inbox. Replies are detected automatically.">
          {gmailNotice && (
            <div className={`alert mb-4 ${gmailNotice.ok ? 'alert-success' : 'alert-error'}`}>
              {gmailNotice.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{gmailNotice.text}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <ConnectionStatusBadge status={inboxStatus} />
              <span className="min-w-0 break-all text-sm text-fg-muted">{user?.email}</span>
            </div>
            <button onClick={connectGmail} disabled={connecting} className="btn btn-secondary">
              {connecting ? 'Redirecting…' : inboxStatus === 'connected' ? 'Reconnect' : 'Connect Gmail'}
            </button>
          </div>
          <p className="hint mt-3">
            To disconnect, remove Mustard from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-fg hover:underline"
            >
              Google Account permissions
            </a>
            .
          </p>
        </Section>

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
