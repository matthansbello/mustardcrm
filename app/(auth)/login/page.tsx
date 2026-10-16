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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Suspense fallback={<div className="text-sm text-fg-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
