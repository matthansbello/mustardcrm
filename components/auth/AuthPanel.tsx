'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Mail, Zap } from 'lucide-react';
import {
  completeMagicLink,
  completeRedirectSignIn,
  friendlyAuthError,
  isMagicLink,
  resetPassword,
  sendMagicLink,
  signInWithOAuth,
  signInWithPassword,
  signUpWithPassword,
  storedMagicLinkEmail,
} from '@/lib/firebase/auth';
import type { OAuthProviderId } from '@/lib/firebase/client';
import { useAuthStore } from '@/lib/store/useAuthStore';

type AuthMethod = OAuthProviderId | 'password' | 'emaillink';

const ALL_METHODS: AuthMethod[] = ['google', 'microsoft', 'apple', 'github', 'password', 'emaillink'];

/** Comma-separated list in NEXT_PUBLIC_AUTH_METHODS hides methods you haven't enabled in Firebase. */
const ENABLED_METHODS: AuthMethod[] = (() => {
  const raw = process.env.NEXT_PUBLIC_AUTH_METHODS;
  if (!raw) return ALL_METHODS;
  const wanted = raw.split(',').map((m) => m.trim().toLowerCase());
  return ALL_METHODS.filter((m) => wanted.includes(m));
})();

const OAUTH_BUTTONS: { id: OAuthProviderId; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'microsoft', label: 'Microsoft', icon: <MicrosoftIcon /> },
  { id: 'apple', label: 'Apple', icon: <AppleIcon /> },
  { id: 'github', label: 'GitHub', icon: <GithubIcon /> },
];

interface AuthPanelProps {
  mode: 'login' | 'signup';
  /** Where to go once signed in. */
  next: string;
}

export function AuthPanel({ mode, next }: AuthPanelProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, authError } = useAuthStore();

  const oauth = OAUTH_BUTTONS.filter((b) => ENABLED_METHODS.includes(b.id));
  const emailMethods = (['password', 'emaillink'] as const).filter((m) => ENABLED_METHODS.includes(m));

  const [tab, setTab] = useState<'password' | 'emaillink'>(emailMethods[0] || 'password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLinkEmail, setConfirmLinkEmail] = useState(false);

  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(target);
    }
  }, [isLoading, isAuthenticated, router, target]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      setBusy(false);
    }
  }, [authError]);

  // Finish redirect-based OAuth and magic-link sign-ins that land back on this page.
  useEffect(() => {
    completeRedirectSignIn().catch((err) => setError(friendlyAuthError(err)));

    const href = window.location.href;
    if (!isMagicLink(href)) return;
    const saved = storedMagicLinkEmail();
    if (saved) {
      setBusy(true);
      completeMagicLink(saved, href).catch((err) => {
        setError(friendlyAuthError(err));
        setBusy(false);
      });
    } else {
      // Link opened on a different device/browser — ask which email it was sent to.
      setTab('emaillink');
      setConfirmLinkEmail(true);
    }
  }, []);

  const run = async (action: () => Promise<unknown>, keepBusy = true) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      // On success the auth listener syncs the profile and the effect above redirects.
      if (!keepBusy) setBusy(false);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const handleOAuth = (id: OAuthProviderId) => run(() => signInWithOAuth(id));

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => (mode === 'signup' ? signUpWithPassword(email, password, name) : signInWithPassword(email, password)));
  };

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmLinkEmail) {
      run(() => completeMagicLink(email, window.location.href));
      return;
    }
    run(async () => {
      await sendMagicLink(email, target);
      setNotice(`We sent a sign-in link to ${email.trim()}. Open it on this device to continue.`);
    }, false);
  };

  const handleReset = () => {
    if (!email.trim()) {
      setError('Enter your email above, then click "Forgot password?" again.');
      return;
    }
    run(async () => {
      await resetPassword(email);
      setNotice(`If an account exists for ${email.trim()}, a password reset email is on its way.`);
    }, false);
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-mustard-500 focus:ring-1 focus:ring-mustard-500';

  return (
    <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6 relative z-10">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center mx-auto shadow-glow-blue mb-4">
          <Zap className="w-6 h-6 text-white stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-bold font-display text-white">
          {mode === 'signup' ? 'Create your Mustard account' : 'Welcome back to Mustard'}
        </h1>
        <p className="text-xs text-dark-muted">
          {mode === 'signup'
            ? 'Join your team’s shared workspace with any sign-in method'
            : 'Sign in with any account you use for Mustard'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {oauth.length > 0 && (
        <div className={`grid gap-2 ${oauth.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {oauth.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleOAuth(b.id)}
              disabled={busy}
              className="py-3 px-4 rounded-xl glass-button border border-white/20 text-white font-medium text-xs flex items-center justify-center gap-2.5 hover:bg-white/10 transition-all shadow-glass disabled:opacity-50"
            >
              {b.icon}
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      )}

      {oauth.length > 0 && emailMethods.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-dark-muted">
          <div className="h-px flex-1 bg-white/10" />
          <span>or use email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      )}

      {emailMethods.length > 1 && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {emailMethods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setTab(m);
                setError(null);
                setNotice(null);
              }}
              className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                tab === m ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'password' ? <KeyRound className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
              {m === 'password' ? 'Password' : 'Email link'}
            </button>
          ))}
        </div>
      )}

      {emailMethods.includes('password') && tab === 'password' && (
        <form onSubmit={handlePassword} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              className={inputClass}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Create a password (6+ characters)' : 'Password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
            required
            className={inputClass}
          />
          {mode === 'login' && (
            <div className="text-right">
              <button type="button" onClick={handleReset} className="text-[11px] text-dark-muted hover:text-white">
                Forgot password?
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl btn-mustard text-xs font-semibold disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      )}

      {emailMethods.includes('emaillink') && tab === 'emaillink' && (
        <form onSubmit={handleMagicLink} className="space-y-3">
          {confirmLinkEmail && (
            <p className="text-[11px] text-dark-muted">Confirm the email address the sign-in link was sent to.</p>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl btn-mustard text-xs font-semibold disabled:opacity-50"
          >
            {busy ? 'Please wait…' : confirmLinkEmail ? 'Continue' : 'Email me a sign-in link'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-dark-muted">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-mustard-400 font-semibold hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-mustard-400 font-semibold hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>

      <p className="text-center text-[11px] text-dark-muted leading-relaxed">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="underline hover:text-white">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-white">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.03-2.77 2.26-4.1 2.36-4.17-1.29-1.88-3.3-2.14-4.01-2.17-1.7-.17-3.33 1-4.2 1-.87 0-2.2-.98-3.62-.95-1.86.03-3.58 1.08-4.54 2.75-1.94 3.36-.5 8.33 1.39 11.06.92 1.33 2.02 2.83 3.46 2.78 1.39-.06 1.91-.9 3.59-.9 1.67 0 2.15.9 3.61.87 1.49-.03 2.44-1.36 3.35-2.7 1.06-1.54 1.49-3.04 1.52-3.12-.03-.01-2.91-1.12-2.91-4.45zM13.62 4.47c.77-.93 1.29-2.22 1.15-3.51-1.11.05-2.45.74-3.25 1.67-.71.82-1.34 2.14-1.17 3.4 1.24.1 2.5-.63 3.27-1.56z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}
