import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import AppShell from '@/components/AppShell';
import './globals.css';

const space = localFont({
  src: './fonts/space-grotesk.woff2',
  variable: '--font-space',
  weight: '300 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinTrack — Personal finance',
  description: 'Your spending, accounts and investments in one personal ledger.',
  applicationName: 'FinTrack',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'FinTrack' },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#101513',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} dark`}>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
