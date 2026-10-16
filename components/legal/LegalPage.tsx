import React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { LEGAL } from '@/lib/legal';

interface LegalPageProps {
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}

/** Shared shell for /privacy and /terms — readable, public, no auth required. */
export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="border-b border-white/10 bg-dark-bg/70 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 via-blue-600 to-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white stroke-[2.5]" />
            </span>
            <span className="font-display font-bold text-white">{LEGAL.productName}</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-dark-muted">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-bold font-display text-white">{title}</h1>
        <p className="mt-2 text-xs text-dark-muted">Last updated: {LEGAL.lastUpdated}</p>
        <div className="legal-prose mt-8">
          <div className="text-gray-300">{intro}</div>
          {children}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-dark-muted flex flex-wrap gap-x-4 gap-y-2 justify-between">
          <span>
            © {new Date().getFullYear()} {LEGAL.companyName}
          </span>
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-white">
            {LEGAL.contactEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
