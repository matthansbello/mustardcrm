'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { usePageTransition } from '@/lib/hooks/usePageTransition';
import { usePathname } from 'next/navigation';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pageRef = usePageTransition<HTMLElement>();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);

  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-dark-bg flex relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-blue-radial opacity-40" />
      <div className="blue-orb w-[400px] h-[400px] -top-32 -right-20 bg-blue-600/20 animate-float-orb" />
      <div
        className="blue-orb w-[300px] h-[300px] bottom-10 left-72 bg-cyan-500/10 animate-float-orb"
        style={{ animationDelay: '2s' }}
      />

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 relative z-10">
        <Header onMenuClick={() => setNavOpen(true)} />
        <main ref={pageRef} className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
