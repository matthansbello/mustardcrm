import type { MetadataRoute } from 'next';

/** Lets people add Mustard to their phone's home screen with the proper icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mustard CRM',
    short_name: 'Mustard',
    description: 'CRM and cold email outreach for your team.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0b0d12',
    theme_color: '#0b0d12',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
