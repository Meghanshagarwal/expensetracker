import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FinTrack — Personal Finance',
    short_name: 'FinTrack',
    description: 'Track spending, card payments, and money shared with people.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#101513',
    theme_color: '#101513',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
