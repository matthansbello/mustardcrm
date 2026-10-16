'use client';

import React from 'react';
import { AuthPanel } from '@/components/auth/AuthPanel';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/15 blur-3xl pointer-events-none animate-glow-pulse" />
      <div className="absolute top-20 left-20 w-[220px] h-[220px] bg-cyan-400/10 blur-3xl pointer-events-none" />
      <AuthPanel mode="signup" next="/onboarding" />
    </div>
  );
}
