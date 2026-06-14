'use client';

import { useEffect, useState } from 'react';
import { Space_Grotesk } from 'next/font/google';
import { JetBrains_Mono } from 'next/font/google';
import PinLogin from '@/components/PinLogin';
import Navbar from '@/components/Navbar';
import '@/app/globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  weight: ['300', '400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    const checkAuth = async () => {
      if (navigator.onLine) {
        try {
          const res = await fetch('/api/auth');
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            return;
          } else {
            setIsAuthenticated(false);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      const localSession = localStorage.getItem('local_session_active');
      if (localSession === 'true') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} dark`}>
      <head>
        <title>FinTrack — Premium Expense Manager</title>
        <meta name="description" content="Ultra-premium personal finance tracker with offline support." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased text-white bg-black font-light">
        {isAuthenticated === null ? (
          <div className="fixed inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
              <span className="text-xs text-[#8A8A8A] tracking-luxury-wide uppercase font-normal">Loading</span>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <PinLogin onSuccess={() => setIsAuthenticated(true)} />
        ) : (
          <div className="min-h-screen flex flex-col pb-24 md:pb-0">
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
