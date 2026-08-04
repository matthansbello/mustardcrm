'use client';

import React, { Suspense } from 'react';
import ContactsPageContent from './ContactsPageContent';

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="text-xs text-dark-muted p-8">Loading contacts...</div>}>
      <ContactsPageContent />
    </Suspense>
  );
}
