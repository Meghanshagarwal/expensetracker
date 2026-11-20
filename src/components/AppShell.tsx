'use client';

import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import Navbar from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('FinTrack offline mode could not start.', error);
      });
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#workspace">Skip to content</a>
      <Navbar />
      <main id="workspace" tabIndex={-1} className="workspace">{children}</main>
    </MotionConfig>
  );
}
