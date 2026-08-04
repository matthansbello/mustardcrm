'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-xs text-dark-muted animate-pulse">Authenticating...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-xs text-dark-muted">Redirecting to login...</div>
      </div>
    );
  }

  return <>{children}</>;
}
