'use client';

import React, { Suspense } from 'react';
import ContactsPageContent from './ContactsPageContent';

export default function ContactsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Loading contacts…</p>}>
      <ContactsPageContent />
    </Suspense>
  );
}
