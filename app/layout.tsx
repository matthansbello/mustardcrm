import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

// Self-hosted (SIL OFL) so builds never depend on reaching Google Fonts.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
});

const bricolage = localFont({
  src: './fonts/BricolageGrotesque-Variable.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-bricolage',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0d12',
};

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: 'Mustard', statusBarStyle: 'black-translucent' },
  title: 'Mustard CRM',
  description: 'Unified CRM and cold outreach platform built natively for Google Workspace teams.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${bricolage.variable}`}>
      <body className="min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
