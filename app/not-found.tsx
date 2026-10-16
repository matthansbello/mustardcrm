import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-sm text-center">
        <div className="flex justify-center">
          <LogoMark size={36} />
        </div>
        <p className="mt-5 text-sm font-medium text-fg-subtle">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-fg">Page not found</h1>
        <p className="mt-2 text-sm text-fg-muted">The page you’re looking for doesn’t exist or has moved.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
