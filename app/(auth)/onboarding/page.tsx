'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { startGmailConnect, updateOrganizationName } from '@/lib/firebase/auth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Logo } from '@/components/brand/Logo';
import { CheckCircle2, ArrowRight, Building, Mail, Users, AlertCircle } from 'lucide-react';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organization, inboxStatus, setOrganization, setInboxStatus } = useAuthStore();

  // Everyone shares one workspace — only admins name it; Google sign-ins may already have Gmail connected.
  const [step, setStep] = useState<1 | 2 | 3>(() =>
    user?.role === 'admin' ? 1 : inboxStatus === 'connected' ? 3 : 2
  );
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (organization?.name && !orgName) {
      setOrgName(organization.name);
    }
  }, [organization?.name, orgName]);

  useEffect(() => {
    if (searchParams?.get('gmail') === 'connected') {
      setIsConnected(true);
      setInboxStatus('connected');
      setStep(3);
    }
  }, [searchParams, setInboxStatus]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !organization?.id) return;
    setSavingName(true);
    setError(null);
    try {
      await updateOrganizationName(organization.id, orgName.trim());
      setOrganization({ ...organization, name: orgName.trim() });
      setStep(2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save organization name';
      setError(message);
    } finally {
      setSavingName(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await startGmailConnect('/onboarding?gmail=connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error connecting inbox';
      console.error(message);
      setError(message);
      setIsConnecting(false);
    }
  };

  const handleFinish = () => {
    router.push('/dashboard');
  };

  const steps = ['Workspace', 'Gmail', 'Contacts'];

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo size={26} textClassName="text-base" />
          <ol className="flex items-center gap-1.5" aria-label="Setup progress">
            {steps.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              return (
                <li
                  key={label}
                  aria-current={step === n ? 'step' : undefined}
                  title={label}
                  className={`h-1.5 w-8 rounded-full ${step >= n ? 'bg-accent' : 'bg-surface-3'}`}
                />
              );
            })}
          </ol>
        </div>

        <div className="card p-6 sm:p-8">
          {error && (
            <div className="alert alert-error mb-5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div>
                <p className="text-xs font-medium text-fg-subtle">Step 1 of 3</p>
                <h1 className="mt-1 text-2xl font-semibold text-fg">Name your workspace</h1>
                <p className="mt-1 text-sm text-fg-muted">
                  Everyone who signs in joins this workspace and sees the same contacts.
                </p>
              </div>
              <div>
                <label htmlFor="ob-name" className="label">
                  Workspace name
                </label>
                <div className="relative">
                  <Building className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                  <input
                    id="ob-name"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="input h-10 pl-9"
                    placeholder="Acme Inc."
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" disabled={savingName} className="btn btn-primary btn-lg w-full">
                {savingName ? 'Saving…' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-fg-subtle">Step 2 of 3</p>
                <h1 className="mt-1 text-2xl font-semibold text-fg">Connect your Gmail</h1>
                <p className="mt-1 text-sm text-fg-muted">
                  Sequences are sent from your own Gmail or Google Workspace address, and replies stop them
                  automatically.
                </p>
              </div>

              <ul className="space-y-3 rounded-lg border border-line bg-surface-2 p-4 text-sm">
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
                  <span className="text-fg-muted">
                    <span className="text-fg">Send email</span> — only the sequence emails you schedule
                  </span>
                </li>
                <li className="flex gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
                  <span className="text-fg-muted">
                    <span className="text-fg">Detect replies</span> — reads message headers only
                  </span>
                </li>
              </ul>

              {isConnected ? (
                <div className="alert alert-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Gmail connected.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={handleConnectGmail} disabled={isConnecting} className="btn btn-primary btn-lg w-full">
                    {isConnecting ? 'Redirecting to Google…' : 'Connect Gmail'}
                  </button>
                  <button type="button" onClick={() => setStep(3)} className="btn btn-ghost w-full">
                    Skip for now
                  </button>
                </div>
              )}
              {isConnected && (
                <button onClick={() => setStep(3)} className="btn btn-primary btn-lg w-full">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-fg-subtle">Step 3 of 3</p>
                <h1 className="mt-1 text-2xl font-semibold text-fg">You’re all set</h1>
                <p className="mt-1 text-sm text-fg-muted">
                  Bring in your contacts now, or head to the dashboard and do it later.
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => router.push('/contacts?import=1')}
                  className="flex items-center gap-3 rounded-lg border border-line p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2">
                    <Users className="h-4 w-4 text-fg-muted" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-fg">Import contacts</span>
                    <span className="block text-xs text-fg-muted">CSV or Excel — columns are matched automatically.</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-fg-subtle" />
                </button>
              </div>

              <button onClick={handleFinish} className="btn btn-secondary btn-lg w-full">
                Go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-fg-muted">Loading…</div>}>
        <OnboardingContent />
      </React.Suspense>
    </AuthGuard>
  );
}
