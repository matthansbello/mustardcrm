'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { useAuthStore } from '@/lib/store/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuthStore();

  React.useEffect(() => {
    if (!requireAuth || isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [requireAuth, isLoading, isAuthenticated, router]);

  if (!requireAuth) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4" role="status" aria-label="Loading">
          <LogoMark size={36} />
          <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-fg-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
