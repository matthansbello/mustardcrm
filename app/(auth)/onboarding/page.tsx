'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { startGmailConnect, updateOrganizationName } from '@/lib/firebase/auth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Zap, CheckCircle2, ArrowRight, Building, Mail, Users, Chrome, AlertCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/15 blur-3xl pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-0 right-0 w-[320px] h-[320px] bg-cyan-400/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl glass-panel p-8 md:p-10 rounded-3xl border border-white/10 space-y-8 relative z-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center shadow-glow-blue">
              <Zap className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
            <span className="font-display font-bold text-lg text-white">Mustard Setup</span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === s
                    ? 'bg-blue-500 text-white shadow-glow-blue'
                    : step > s
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-white/5 text-gray-500'
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-mustard-400 uppercase tracking-wider">Step 1 of 3</span>
              <h2 className="text-2xl font-bold font-display text-white">Name your team workspace</h2>
              <p className="text-xs text-dark-muted">Everyone who signs in joins this workspace and sees the same contacts.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Workspace / Company Name</label>
              <div className="relative">
                <Building className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-mustard-500 focus:ring-1 focus:ring-mustard-500"
                  placeholder="e.g. Acme Corp"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingName}
              className="w-full py-3.5 rounded-xl btn-mustard text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{savingName ? 'Saving...' : 'Continue to Connect Inbox'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-mustard-400 uppercase tracking-wider">Step 2 of 3</span>
              <h2 className="text-2xl font-bold font-display text-white">Connect Gmail Inbox</h2>
              <p className="text-xs text-dark-muted">
                Mustard sends sequence emails from your real Gmail or Google Workspace address. Personal @gmail.com accounts are fully supported.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-mustard-500/10 border border-mustard-500/30 flex items-center justify-center text-mustard-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gmail OAuth Permission Scope</h4>
                  <p className="text-[11px] text-dark-muted">Requires `gmail.send` and `gmail.readonly` access.</p>
                </div>
              </div>

              {isConnected ? (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Inbox successfully authorized!</span>
                </div>
              ) : (
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                  className="w-full py-3.5 px-4 rounded-xl btn-mustard text-black font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Chrome className="w-4 h-4" />
                  <span>{isConnecting ? 'Redirecting to Google...' : 'Authorize Gmail Connection'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full text-center text-[11px] text-dark-muted hover:text-white"
              >
                Skip for now — connect later in Settings
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-mustard-400 uppercase tracking-wider">Step 3 of 3</span>
              <h2 className="text-2xl font-bold font-display text-white">Ready to launch</h2>
              <p className="text-xs text-dark-muted">Import contacts now via CSV or head straight to your dashboard.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleFinish}
                className="p-5 rounded-2xl glass-panel glass-panel-hover border border-white/10 text-left space-y-2 group"
              >
                <Users className="w-5 h-5 text-mustard-400 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-bold text-white">Import Contacts Later</h4>
                <p className="text-[11px] text-dark-muted">Go to dashboard and add leads manually or via CSV anytime.</p>
              </button>

              <button
                onClick={() => router.push('/contacts?import=1')}
                className="p-5 rounded-2xl glass-panel glass-panel-hover border border-mustard-500/30 bg-mustard-500/10 text-left space-y-2 group"
              >
                <Zap className="w-5 h-5 text-mustard-400 group-hover:scale-110 transition-transform" />
                <h4 className="text-sm font-bold text-white">Import CSV Now</h4>
                <p className="text-[11px] text-dark-muted">Upload your lead spreadsheet with automatic column mapping.</p>
              </button>
            </div>

            <button onClick={handleFinish} className="w-full py-3.5 rounded-xl btn-mustard text-xs font-semibold">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <React.Suspense fallback={<div className="min-h-screen bg-dark-bg flex items-center justify-center text-xs text-dark-muted">Loading...</div>}>
        <OnboardingContent />
      </React.Suspense>
    </AuthGuard>
  );
}
