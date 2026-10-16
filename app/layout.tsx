import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

// Self-hosted (SIL OFL) so builds never depend on reaching Google Fonts.
const bricolage = localFont({
  src: './fonts/BricolageGrotesque-Variable.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-bricolage',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Mustard CRM',
  description: 'Unified CRM and cold outreach platform built natively for Google Workspace teams.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${bricolage.variable}`}>
      <body className="bg-dark-bg text-gray-100 min-h-screen antialiased bg-grid-pattern selection:bg-blue-500 selection:text-white font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
