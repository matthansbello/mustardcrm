'use client';

import React from 'react';

/** Replaces the root layout when it crashes, so it can't rely on the app stylesheet — inline styles only. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0d12',
          color: '#e8eaef',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <svg viewBox="59 79 962 921" width={38} height={36} aria-label="Mustard" style={{ marginBottom: 20 }}>
            <defs>
              <linearGradient id="ge-logo" gradientUnits="userSpaceOnUse" x1="250" y1="950" x2="900" y2="250">
                <stop offset="0" stopColor="#3459fc" />
                <stop offset="0.5" stopColor="#4f9afa" />
                <stop offset="1" stopColor="#63c3f8" />
              </linearGradient>
            </defs>
            <g fill="url(#ge-logo)">
              <path d="M59 79H329V1000A270 270 0 0 1 59 730Z" />
              <path d="M405 79H675V865A135 135 0 0 1 405 865Z" />
              <path d="M751 79A270 270 0 0 1 1021 349V1000H751Z" />
            </g>
          </svg>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Mustard couldn’t load</h1>
          <p style={{ color: '#969dae', fontSize: 14, marginTop: 8 }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              border: 0,
              background: '#3b82f6',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
