'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-white">
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
            <h1 className="text-2xl font-bold font-display text-white">Application Error</h1>
            <p className="text-xs text-dark-muted">{error.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-xl btn-mustard text-white text-xs font-semibold shadow-glow-blue"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
