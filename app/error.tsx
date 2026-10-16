'use client';

import React, { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">
          <TriangleAlert className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-fg">Something went wrong</h1>
        <p className="mt-2 text-sm text-fg-muted">{error.message || 'An unexpected error occurred.'}</p>
        <button onClick={() => reset()} className="btn btn-primary mt-6">
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
