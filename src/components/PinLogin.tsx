'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete } from 'lucide-react';

interface PinLoginProps {
  onSuccess: () => void;
}

export default function PinLogin({ onSuccess }: PinLoginProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setError(null);
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    // If offline, check against cached auth token in localStorage
    if (!navigator.onLine) {
      const cachedPinHash = localStorage.getItem('app_pin_hash');
      if (cachedPinHash) {
        const enteredHash = btoa(pin); 
        if (enteredHash === cachedPinHash) {
          onSuccess();
          setLoading(false);
          return;
        }
      }
      setError('Incorrect PIN (Offline validation failed)');
      setPin('');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        localStorage.setItem('app_pin_hash', btoa(pin));
        onSuccess();
      } else {
        setError('Invalid passcode. Please try again.');
        setPin('');
      }
    } catch (err) {
      setError('Connection error. Please check your network.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F172A] px-6 text-white">
      <div className="absolute top-1/4 left-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30"
        >
          <Lock className="h-8 w-8 animate-pulse" />
        </motion.div>

        <h1 className="mb-2 text-2xl font-bold font-sans tracking-wide">Enter PIN to Unlock</h1>
        <p className="mb-8 text-sm text-slate-400">Please enter your 4-digit passcode</p>

        <div className="mb-8 flex gap-5">
          {[0, 1, 2, 3].map(index => (
            <div
              key={index}
              className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                index < pin.length
                  ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                  : 'border-slate-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        <div className="h-6 mb-6">
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-semibold text-red-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-6 w-full px-4 justify-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={num}
              onClick={() => handleKeyPress(num)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-xl font-semibold border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
            >
              {num}
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleClear}
            className="flex h-16 w-16 items-center justify-center text-sm font-semibold text-slate-400 hover:text-white"
          >
            Clear
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleKeyPress('0')}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-xl font-semibold border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
          >
            0
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDelete}
            className="flex h-16 w-16 items-center justify-center text-slate-400 hover:text-white"
          >
            <Delete className="h-6 w-6" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
