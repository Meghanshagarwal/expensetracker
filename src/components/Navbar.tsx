'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Users, LogOut, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (navigator.onLine) {
      try {
        await fetch('/api/auth', { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('local_session_active');
    localStorage.removeItem('app_pin_hash');
    localStorage.removeItem('biometric_credential_id');
    localStorage.removeItem('biometric_setup_declined');
    window.location.reload();
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Cards', path: '/cards', icon: CreditCard },
    { name: 'Salary', path: '/salary', icon: Wallet },
    { name: 'People', path: '/people', icon: Users },
  ];

  return (
    <>
      {/* Desktop Navigation — Luxury Top Bar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] text-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center font-semibold text-lg text-gold-400">
            ₹
          </div>
          <span className="text-xl font-medium tracking-wide text-white">
            FinTrack
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-5 py-2.5 text-sm font-normal transition-colors rounded-lg ${
                  isActive ? 'text-white' : 'text-[#8A8A8A] hover:text-white'
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeTabDesktop"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-gold-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="w-px h-6 bg-white/[0.08] mx-3" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-white/[0.04] transition-all text-sm font-normal"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </header>

      {/* Mobile Bottom Navigation — Frosted Dark Glass */}
      <nav className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[88%] max-w-sm bg-[#111111]/90 backdrop-blur-2xl border border-white/[0.06] rounded-2xl py-3 px-4 shadow-luxury flex items-center justify-around text-white">
        {navItems.map(item => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 transition-all ${
                isActive ? 'text-gold-400' : 'text-[#555555] hover:text-[#8A8A8A]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[9px] font-medium tracking-luxury-wide uppercase">
                {item.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTabMobile"
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-gold-400"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 py-1 px-3 text-[#555555] hover:text-[#8A8A8A] transition-all"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[9px] font-medium tracking-luxury-wide uppercase">
            Exit
          </span>
        </button>
      </nav>

      {/* Spacing for Desktop Header */}
      <div className="hidden md:block h-20" />
    </>
  );
}
