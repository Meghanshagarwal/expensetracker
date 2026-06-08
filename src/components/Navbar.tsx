'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Users, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    window.location.reload();
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'People', path: '/people', icon: Users },
  ];

  return (
    <>
      {/* Desktop Navigation (Top Bar) */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-40 items-center justify-between px-8 py-4 bg-[#1E293B]/80 backdrop-blur-md border-b border-slate-700/50 text-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center font-bold text-lg">
            ₹
          </div>
          <span className="text-xl font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400 font-sans">
            FinTrack
          </span>
        </div>

        <nav className="flex items-center gap-6">
          {navItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative px-4 py-2 text-sm font-medium transition-colors hover:text-white ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeTabDesktop"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-violet-500"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md bg-[#1E293B]/80 backdrop-blur-md border border-slate-700/50 rounded-2xl py-3 px-6 shadow-2xl flex items-center justify-between text-white">
        {navItems.map(item => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-blue-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">
                {item.name}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-400 transition-all"
        >
          <LogOut className="h-6 w-6" />
          <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">
            Logout
          </span>
        </button>
      </nav>

      {/* Spacing for Desktop Header */}
      <div className="hidden md:block h-20" />
    </>
  );
}
