'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithGoogle, syncUserProfile, flushPendingMailboxTokens } from '@/lib/firebase/auth';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Zap, Chrome, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, isLoading, setUser, setOrganization } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(next.startsWith('/') ? next : '/dashboard');
    }
  }, [isLoading, isAuthenticated, router, next]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const fbUser = await signInWithGoogle();
      const { user, organization } = await syncUserProfile(fbUser);
      setUser(user);
      setOrganization(organization);

      document.cookie = `__mustard_auth=1; path=/; max-age=${60 * 60 * 24 * 5}; SameSite=Lax`;
      const idToken = await fbUser.getIdToken();
      await flushPendingMailboxTokens(idToken, organization.id);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const target = next.startsWith('/') ? next : '/dashboard';
      window.location.href = target;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign-in failed. Check Firebase Auth configuration.';
      console.error('Google sign-in error:', err);
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6 relative z-10">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center mx-auto shadow-glow-blue mb-4">
          <Zap className="w-6 h-6 text-white stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-bold font-display text-white">Welcome back to Mustard</h1>
          <p className="text-xs text-dark-muted">Sign in with Gmail or Google Workspace</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full py-3.5 px-4 rounded-xl glass-button border border-white/20 text-white font-medium text-xs flex items-center justify-center gap-3 hover:bg-white/10 transition-all shadow-glass disabled:opacity-50"
      >
        <Chrome className="w-4 h-4 text-mustard-400" />
        <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
      </button>

      <p className="text-center text-xs text-dark-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-mustard-400 font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/15 blur-3xl pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-10 right-10 w-[280px] h-[280px] bg-cyan-400/10 blur-3xl pointer-events-none" />
      <Suspense fallback={<div className="text-xs text-dark-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
