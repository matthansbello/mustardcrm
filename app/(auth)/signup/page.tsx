'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { Zap, Chrome, ShieldCheck, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push('/onboarding');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Check Firebase Auth configuration.';
      console.error('Google signup error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/15 blur-3xl pointer-events-none animate-glow-pulse" />
      <div className="absolute top-20 left-20 w-[220px] h-[220px] bg-cyan-400/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center mx-auto shadow-glow-blue mb-4">
            <Zap className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white">Create your Mustard workspace</h1>
          <p className="text-xs text-dark-muted">Get started in under 2 minutes with Google Workspace</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl btn-mustard text-white font-semibold text-xs flex items-center justify-center gap-3 shadow-glow-blue disabled:opacity-50"
        >
          <Chrome className="w-4 h-4 text-black" />
          <span>{loading ? 'Creating account...' : 'Sign up with Google Workspace'}</span>
        </button>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Only requests essential Gmail scopes (`gmail.send`, `gmail.readonly`) for outreach.</span>
        </div>

        <p className="text-center text-xs text-dark-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-mustard-400 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
