'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 text-white text-center">
      <div className="max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display">Something went wrong</h1>
          <p className="text-xs text-dark-muted">{error.message || 'An unexpected error occurred.'}</p>
        </div>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-mustard text-white text-xs font-semibold shadow-glow-blue"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
