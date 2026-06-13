'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Person } from '@/types';

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  personToEdit?: Person | null;
  addPersonOffline: (name: string) => Promise<any>;
}

export default function PersonModal({
  isOpen,
  onClose,
  onSuccess,
  personToEdit,
  addPersonOffline,
}: PersonModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personToEdit) {
      setName(personToEdit.name);
    } else {
      setName('');
    }
    setError(null);
  }, [personToEdit, isOpen]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    if (!navigator.onLine) {
      try {
        if (personToEdit) {
          setError('Offline editing is currently read-only. You can add new persons offline.');
          setLoading(false);
          return;
        }
        await addPersonOffline(name.trim());
        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save offline');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const url = '/api/persons';
      const method = personToEdit ? 'PUT' : 'POST';
      const body = personToEdit
        ? { id: personToEdit._id, name: name.trim() }
        : { name: name.trim() };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save person');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full md:max-w-md overflow-hidden rounded-t-3xl md:rounded-3xl bg-[#111111] border-t md:border border-white/[0.08] p-6 pb-12 md:pb-6 text-white shadow-luxury-lg z-10"
          >
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1 bg-white/[0.1] rounded-full mx-auto mb-5 md:hidden" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-light tracking-tight flex items-center gap-2 text-white">
                <UserPlus className="h-4.5 w-4.5 text-gold-400" />
                {personToEdit ? 'Edit Person' : 'New Contact'}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 hover:bg-white/[0.04] text-[#8A8A8A] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-3 text-xs text-[#FF5A5F] font-normal">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-normal uppercase tracking-luxury-wide text-[#8A8A8A] mb-2">
                  Full Name / Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Family, Office, Rohit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-black border border-white/[0.08] px-4 py-3 text-base md:text-sm focus:border-gold-400/40 text-white placeholder-[#555555] transition-colors"
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-normal bg-[#171717] border border-white/[0.06] hover:bg-[#1c1c1c] text-[#8A8A8A] hover:text-white transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-medium bg-gold-400 hover:bg-gold-500 text-black transition-all disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {personToEdit ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
