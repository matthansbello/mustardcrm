'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthPanel } from '@/components/auth/AuthPanel';

function LoginForm() {
  const searchParams = useSearchParams();
  return <AuthPanel mode="login" next={searchParams?.get('next') || '/dashboard'} />;
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
