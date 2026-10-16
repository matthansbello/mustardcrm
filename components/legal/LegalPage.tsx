import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { LEGAL } from '@/lib/legal';

interface LegalPageProps {
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}

/** Shared shell for /privacy and /terms — readable, public, no auth required. */
export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" aria-label={`${LEGAL.productName} home`}>
            <Logo size={24} />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-fg-muted">
            <Link href="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-fg">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold text-fg sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-fg-subtle">Last updated: {LEGAL.lastUpdated}</p>
        <div className="legal-prose mt-8">
          <div>{intro}</div>
          {children}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-fg-subtle flex flex-wrap gap-x-4 gap-y-2 justify-between">
          <span>
            © {new Date().getFullYear()} {LEGAL.companyName}
          </span>
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-fg">
            {LEGAL.contactEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
