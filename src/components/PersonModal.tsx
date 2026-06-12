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
            className="relative w-full md:max-w-md overflow-hidden rounded-t-2xl md:rounded-2xl bg-card border-t md:border border-border p-6 pb-12 md:pb-6 text-white shadow-2xl z-10"
          >
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mb-4 md:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {personToEdit ? 'Edit Person' : 'Add Person'}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Full Name / Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Family, Office Colleague, Rohit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-border px-4 py-3 text-base md:text-sm focus:border-primary focus:outline-none transition-colors"
                  disabled={loading}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 border border-border hover:bg-slate-700/60 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-fuchsia-500 hover:from-primary-dark hover:to-fuchsia-600 shadow-[0_4px_12px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {personToEdit ? 'Save Changes' : 'Add Person'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
