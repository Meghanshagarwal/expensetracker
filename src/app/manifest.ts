import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expense Tracker',
    short_name: 'Expenses',
    description: 'A premium dark-themed expense tracker optimized for mobile and desktop.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#3B82F6',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
