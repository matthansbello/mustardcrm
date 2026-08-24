'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 text-white text-center">
      <div className="max-w-md glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-display">404 - Page Not Found</h1>
          <p className="text-xs text-dark-muted">The page you are looking for does not exist or has been moved.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-mustard text-white text-xs font-semibold shadow-glow-blue"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
