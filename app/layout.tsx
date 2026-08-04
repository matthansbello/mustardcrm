import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

export const metadata: Metadata = {
  title: 'Mustard — CRM & Cold Email Platform for Google Workspace',
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
