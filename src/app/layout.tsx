'use client';

import { useEffect, useState } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import PinLogin from '@/components/PinLogin';
import Navbar from '@/components/Navbar';
import '@/app/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            console.log('ServiceWorker registration failed: ', err);
          }
        );
      });
    }

    const checkAuth = async () => {
      if (navigator.onLine) {
        try {
          const res = await fetch('/api/auth');
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      const cachedHash = localStorage.getItem('app_pin_hash');
      if (cachedHash) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} dark`}>
      <head>
        <title>FinTrack - Premium Personal Expense Manager</title>
        <meta name="description" content="Manage your personal finances, track expenses, and view insights offline or online." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0F172A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased text-white bg-[#0F172A]">
        {isAuthenticated === null ? (
          <div className="fixed inset-0 flex items-center justify-center bg-[#0F172A]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : !isAuthenticated ? (
          <PinLogin onSuccess={() => setIsAuthenticated(true)} />
        ) : (
          <div className="min-h-screen flex flex-col pb-24 md:pb-0">
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
