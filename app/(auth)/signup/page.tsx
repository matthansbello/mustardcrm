'use client';

import React from 'react';
import { AuthPanel } from '@/components/auth/AuthPanel';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <AuthPanel mode="signup" next="/onboarding" />
    </div>
  );
}
