'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Edit2, Trash2, User, X, CreditCard, 
  Calendar, Loader2, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { getLocalPersons, getLocalExpenses } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Person, Expense } from '@/types';
import PersonModal from '@/components/PersonModal';

export default function PeoplePage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Ledger States
  const [selectedPersonForLedger, setSelectedPersonForLedger] = useState<Person | null>(null);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  // Inline Repayment Form States
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [repaymentUpiApp, setRepaymentUpiApp] = useState<'GPay' | 'Amazon Pay' | 'Cred UPI'>('GPay');
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [repaymentNotes, setRepaymentNotes] = useState('');
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);
  
  // Ledger Form State
  const [ledgerType, setLedgerType] = useState<'lent' | 'received' | 'borrowed' | 'repaid'>('lent');
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgerPaymentMethod, setLedgerPaymentMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [ledgerUpiApp, setLedgerUpiApp] = useState<'GPay' | 'Amazon Pay' | 'Cred UPI'>('GPay');
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    addPersonOffline,
    addExpenseOffline,
    fetchAndCacheData,
  } = useOfflineSync();

  const loadData = useCallback(async () => {
    const localPer = await getLocalPersons();
    const localExp = await getLocalExpenses();
    setPersons(localPer);
    setExpenses(localExp);

    if (navigator.onLine) {
      try {
        await fetchAndCacheData();
        const updatedPer = await getLocalPersons();
        const updatedExp = await getLocalExpenses();
        setPersons(updatedPer);
        setExpenses(updatedExp);
      } catch (err) {
        console.error('Failed to sync and load updated data:', err);
      }
    }
  }, [fetchAndCacheData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep selected person updated with new data if loaded
  const currentPersonForLedger = useMemo(() => {
    if (!selectedPersonForLedger) return null;
    return persons.find(p => p._id === selectedPersonForLedger._id) || selectedPersonForLedger;
  }, [selectedPersonForLedger, persons]);

  // Prevent background scroll when ledger is open
  useEffect(() => {
    if (selectedPersonForLedger) {
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
  }, [selectedPersonForLedger]);

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this person?')) return;

    if (!navigator.onLine) {
      alert('Deleting people is currently disabled offline.');
      return;
    }

    try {
      const res = await fetch(`/api/persons?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete person');
      }
    } catch (e) {
      alert('Error connecting to server');
    }
  };

  const handleDeleteLedgerItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    if (!navigator.onLine) {
      alert('Deleting transactions is currently disabled offline.');
      return;
    }

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        alert('Failed to delete transaction');
      }
    } catch (e) {
      alert('Error connecting to server');
    }
  };

  const handleAddLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerAmount || parseFloat(ledgerAmount) <= 0 || !currentPersonForLedger) return;

    setFormLoading(true);
    setFormError(null);

    // Auto-generate a title if empty
    const resolvedTitle = ledgerTitle.trim() || (
      ledgerType === 'lent' ? 'Udhaar Diya' :
      ledgerType === 'borrowed' ? 'Udhaar Liya' :
      ledgerType === 'received' ? 'Wapas Mila' : 'Wapas Diya'
    );

    const payload = {
      title: resolvedTitle,
      amount: parseFloat(ledgerAmount),
      category: 'Other',
      transactionType: ledgerType,
      personId: currentPersonForLedger._id,
      paymentMethod: ledgerPaymentMethod,
      date: new Date(ledgerDate).toISOString(),
      notes: ledgerNotes.trim(),
      sourceAccount: 'Self Account',
      upiApp: ledgerPaymentMethod === 'UPI' ? ledgerUpiApp : undefined,
    };

    try {
      if (!navigator.onLine) {
        await addExpenseOffline(payload);
        loadData();
        setIsAddingTransaction(false);
        resetLedgerForm();
        return;
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadData();
        setIsAddingTransaction(false);
        resetLedgerForm();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to save transaction');
      }
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const resetLedgerForm = () => {
    setLedgerType('lent');
    setLedgerTitle('');
    setLedgerAmount('');
    setLedgerDate(new Date().toISOString().split('T')[0]);
    setLedgerPaymentMethod('UPI');
    setLedgerUpiApp('GPay');
    setLedgerNotes('');
    setFormError(null);
  };

  const handleAddRepaymentSubmit = async (e: React.FormEvent, expense: Expense) => {
    e.preventDefault();
    if (!repaymentAmount || parseFloat(repaymentAmount) <= 0) return;

    if (!navigator.onLine) {
      alert('Adding repayments is currently disabled offline.');
      return;
    }

    setRepaymentLoading(true);
    setRepaymentError(null);

    const newRepayment = {
      amount: parseFloat(repaymentAmount),
      paymentMethod: repaymentMethod,
      upiApp: repaymentMethod === 'UPI' ? repaymentUpiApp : undefined,
      date: new Date(repaymentDate).toISOString(),
      notes: repaymentNotes.trim() || undefined,
    };

    const updatedRepayments = [...(expense.repayments || []), newRepayment];

    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: expense._id,
          repayments: updatedRepayments,
        }),
      });

      if (res.ok) {
        await loadData();
        // Clear form
        setRepaymentAmount('');
        setRepaymentNotes('');
        setRepaymentDate(new Date().toISOString().split('T')[0]);
      } else {
        const data = await res.json();
        setRepaymentError(data.error || 'Failed to save repayment');
      }
    } catch (err: any) {
      setRepaymentError(err.message || 'Something went wrong');
    } finally {
      setRepaymentLoading(false);
    }
  };

  const handleDeleteRepayment = async (expense: Expense, repaymentIndex: number) => {
    if (!window.confirm('Are you sure you want to delete this repayment?')) return;

    if (!navigator.onLine) {
      alert('Deleting repayments is currently disabled offline.');
      return;
    }

    const updatedRepayments = (expense.repayments || []).filter((_, idx) => idx !== repaymentIndex);

    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: expense._id,
          repayments: updatedRepayments,
        }),
      });

      if (res.ok) {
        await loadData();
      } else {
        alert('Failed to delete repayment');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  const allPersonStats = useMemo(() => {
    const statsMap = new Map<string, { 
      count: number; 
      totalExpenses: number; 
      totalLent: number; 
      totalBorrowed: number; 
      netLoan: number;
      lastActive: string | null;
    }>();

    const personMap = new Map(persons.map(p => [p._id, p.name]));

    expenses.forEach(exp => {
      const current = statsMap.get(exp.personId) || { 
        count: 0, 
        totalExpenses: 0, 
        totalLent: 0, 
        totalBorrowed: 0, 
        netLoan: 0,
        lastActive: null 
      };
      
      current.count++;
      const type = exp.transactionType || 'expense';
      const personName = personMap.get(exp.personId) || '';
      const isSelf = personName.toLowerCase() === 'self' || personName.toLowerCase() === 'my self';

      if (type === 'expense') {
        current.totalExpenses += exp.amount;
        if (!isSelf) {
          current.totalLent += exp.amount;
          current.netLoan += exp.amount;
        }
      } else if (type === 'lent') {
        current.totalLent += exp.amount;
        current.netLoan += exp.amount;
      } else if (type === 'received') {
        current.netLoan -= exp.amount;
      } else if (type === 'borrowed') {
        current.totalBorrowed += exp.amount;
        current.netLoan -= exp.amount;
      } else if (type === 'repaid') {
        current.netLoan += exp.amount;
      }

      if (!current.lastActive || new Date(exp.date) > new Date(current.lastActive)) {
        current.lastActive = exp.date;
      }

      statsMap.set(exp.personId, current);
    });

    return statsMap;
  }, [expenses, persons]);

  // Filter and sort ledger list for selected person
  const personLedgerExpenses = useMemo(() => {
    if (!currentPersonForLedger) return [];
    return expenses
      .filter(exp => exp.personId === currentPersonForLedger._id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentPersonForLedger, expenses]);

  // Input styles
  const inputClass =
    'w-full rounded-xl bg-black border border-white/[0.08] px-4 py-2.5 text-base md:text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/10 focus:outline-none transition-all';
  const labelClass =
    'block text-xs font-normal uppercase tracking-wider text-[#8A8A8A] mb-1.5';

  return (
    <div className="space-y-8 text-white pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-gold-400" />
          </div>
          <div>
            <h1 className="text-xl font-light tracking-tight">People Management</h1>
            <p className="text-xs text-[#8A8A8A] font-light">Manage individuals and groups linked to expenses</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingPerson(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gold-400 hover:bg-gold-500 text-black rounded-xl text-xs font-medium transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Person</span>
        </button>
      </div>

      {persons.length === 0 ? (
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-10 text-center text-[#555555] text-sm font-light">
          No persons recorded. Create a person to assign expenses to them.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map(person => {
            const { count, totalExpenses, totalLent, totalBorrowed, netLoan, lastActive } = allPersonStats.get(person._id) || { count: 0, totalExpenses: 0, totalLent: 0, totalBorrowed: 0, netLoan: 0, lastActive: null };
            const isTemp = person._id.startsWith('temp_');
            return (
              <div
                key={person._id}
                onClick={() => setSelectedPersonForLedger(person)}
                className="bg-[#111111] cursor-pointer border border-white/[0.06] p-5 rounded-2xl flex flex-col justify-between hover:border-gold-400/20 transition-all duration-300 shadow-luxury hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-black text-[#8A8A8A] flex items-center justify-center border border-white/[0.08]">
                      <User className="h-5 w-5 text-gold-400/80" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white flex items-center gap-1.5">
                        {person.name}
                        {isTemp && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-gold-400/15 text-gold-400 border border-gold-400/25">
                            Offline
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[#8A8A8A] font-light mt-0.5">
                        {count === 0 ? 'No transactions' : `${count} transactions`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-4">
                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Total Share</span>
                      <p className="text-sm font-semibold text-white mt-0.5">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Net Balance</span>
                      {netLoan > 0 ? (
                        <p className="text-sm font-semibold text-[#4ADE80] mt-0.5">Owes ₹{netLoan.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      ) : netLoan < 0 ? (
                        <p className="text-sm font-semibold text-[#FF5A5F] mt-0.5 font-sans">You owe ₹{Math.abs(netLoan).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      ) : (
                        <p className="text-sm font-medium text-[#555555] mt-0.5">Settled</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Total Lent</span>
                      <p className="text-sm font-semibold text-white/90 mt-0.5">₹{totalLent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Total Borrowed</span>
                      <p className="text-sm font-semibold text-white/90 mt-0.5">₹{totalBorrowed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {lastActive && (
                    <div className="text-[10px] text-[#555555] font-light pt-1 border-t border-white/[0.03]">
                      Last active: {new Date(lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-1 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(person);
                      }}
                      className="p-2 hover:bg-white/[0.04] text-[#555555] hover:text-white rounded-lg transition-all"
                      disabled={isTemp}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(person._id);
                      }}
                      className="p-2 hover:bg-[#FF5A5F]/5 text-[#555555] hover:text-[#FF5A5F] rounded-lg transition-all"
                      disabled={isTemp}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Person Ledger Drawer/Modal */}
      <AnimatePresence>
        {currentPersonForLedger && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedPersonForLedger(null);
                setIsAddingTransaction(false);
                resetLedgerForm();
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ y: '100%', opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="relative w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl bg-[#111111] border-t md:border border-white/[0.06] p-6 pb-12 md:pb-6 text-white shadow-luxury z-10 max-h-[92vh] md:max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Handle */}
              <div className="w-12 h-1.5 bg-white/[0.12] rounded-full mx-auto mb-4 md:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] shrink-0">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2.5 text-white">
                    <User className="h-5 w-5 text-gold-400" />
                    <span>{currentPersonForLedger.name}&apos;s Ledger</span>
                  </h2>
                  <div className="mt-1">
                    {(() => {
                      const stats = allPersonStats.get(currentPersonForLedger._id) || { netLoan: 0 };
                      if (stats.netLoan > 0) {
                        return <span className="text-xs font-semibold text-[#4ADE80]">Owes you ₹{stats.netLoan.toLocaleString('en-IN')}</span>;
                      } else if (stats.netLoan < 0) {
                        return <span className="text-xs font-semibold text-[#FF5A5F]">You owe ₹{Math.abs(stats.netLoan).toLocaleString('en-IN')}</span>;
                      } else {
                        return <span className="text-xs font-semibold text-[#8A8A8A]">Settled Balance</span>;
                      }
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPersonForLedger(null);
                    setIsAddingTransaction(false);
                    resetLedgerForm();
                  }}
                  className="rounded-lg p-1.5 text-[#8A8A8A] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content area: Scrollable list */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Form to add transaction in ledger */}
                {isAddingTransaction ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black/50 border border-white/[0.06] p-4 rounded-xl space-y-4"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-white/[0.04]">
                      <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider">Record Transaction</h4>
                      <button
                        type="button"
                        onClick={() => setIsAddingTransaction(false)}
                        className="text-xs text-[#8A8A8A] hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    {formError && (
                      <div className="rounded-lg bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2.5 text-xs text-[#FF5A5F]">
                        {formError}
                      </div>
                    )}

                    <form onSubmit={handleAddLedgerSubmit} className="space-y-4">
                      {/* Sub-type selection */}
                      <div>
                        <label className={labelClass}>Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['lent', 'received'] as const).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setLedgerType(type)}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                                ledgerType === type
                                  ? 'bg-[#4ADE80]/10 border-[#4ADE80]/30 text-[#4ADE80]'
                                  : 'bg-black border-white/[0.08] text-[#8A8A8A] hover:text-white'
                              }`}
                            >
                              {type === 'lent' ? 'We Lent (Udhaar Diya)' : 'They Repaid (Udhaar Back)'}
                            </button>
                          ))}
                          {(['borrowed', 'repaid'] as const).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setLedgerType(type)}
                              className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                                ledgerType === type
                                  ? 'bg-[#FF5A5F]/10 border-[#FF5A5F]/30 text-[#FF5A5F]'
                                  : 'bg-black border-white/[0.08] text-[#8A8A8A] hover:text-white'
                              }`}
                            >
                              {type === 'borrowed' ? 'We Borrowed (Liya)' : 'We Repaid (Chukaya)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title & Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Title (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Cash payment, GPay back"
                            value={ledgerTitle}
                            onChange={(e) => setLedgerTitle(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Amount (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="0.00"
                            value={ledgerAmount}
                            onChange={(e) => setLedgerAmount(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Date & Payment Method */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Date</label>
                          <input
                            type="date"
                            required
                            value={ledgerDate}
                            onChange={(e) => setLedgerDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Payment Method</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['Cash', 'UPI'] as const).map(method => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setLedgerPaymentMethod(method)}
                                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                                  ledgerPaymentMethod === method
                                    ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                                    : 'bg-black border-white/[0.08] text-[#8A8A8A] hover:text-white'
                                }`}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* UPI details */}
                      {ledgerPaymentMethod === 'UPI' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-black/40 p-3 rounded-xl border border-white/[0.04]"
                        >
                          <label className="block text-xs font-normal uppercase tracking-wider text-gold-400 mb-1.5">UPI App</label>
                          <select
                            value={ledgerUpiApp}
                            onChange={(e) => setLedgerUpiApp(e.target.value as any)}
                            className={inputClass}
                          >
                            <option value="GPay">GPay</option>
                            <option value="Amazon Pay">Amazon Pay</option>
                            <option value="Cred UPI">Cred UPI</option>
                          </select>
                        </motion.div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className={labelClass}>Notes</label>
                        <input
                          type="text"
                          placeholder="Repayment notes..."
                          value={ledgerNotes}
                          onChange={(e) => setLedgerNotes(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={formLoading}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all disabled:opacity-50"
                      >
                        {formLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Record Transaction
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setIsAddingTransaction(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-[#171717] hover:bg-white/[0.02] border border-white/[0.06] hover:border-gold-400/20 text-[#8A8A8A] hover:text-gold-400 rounded-xl text-xs font-semibold transition-all shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Record Repayment or New Loan</span>
                  </button>
                )}

                {/* List of ledger history */}
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider">Transaction History</h3>

                  {personLedgerExpenses.length === 0 ? (
                    <div className="py-12 text-center text-[#555555] text-xs font-light">
                      No loan or repayment history recorded for this person.
                    </div>
                  ) : (
                    personLedgerExpenses.map(exp => {
                      const type = exp.transactionType || 'expense';
                      const personName = currentPersonForLedger.name;
                      const isSelf = personName.toLowerCase() === 'self' || personName.toLowerCase() === 'my self';
                      
                      const isLentFlow = type === 'lent' || type === 'received' || (type === 'expense' && !isSelf);
                      const isOutflow = type === 'lent' || type === 'repaid' || (type === 'expense' && !isSelf);
                      const isExpanded = expandedExpenseId === exp._id;
                      const totalRepayments = exp.repayments ? exp.repayments.reduce((sum, r) => sum + r.amount, 0) : 0;
                      const canHaveRepayments = type === 'lent' || type === 'borrowed' || (type === 'expense' && !isSelf);

                      return (
                        <div
                          key={exp._id}
                          onClick={() => {
                            if (canHaveRepayments) {
                              setExpandedExpenseId(isExpanded ? null : exp._id);
                              // Reset form errors
                              setRepaymentError(null);
                            }
                          }}
                          className={`bg-[#171717] border ${
                            isExpanded ? 'border-gold-400/20' : 'border-white/[0.04]'
                          } rounded-xl p-3.5 transition-all duration-300 ${
                            canHaveRepayments ? 'cursor-pointer hover:border-white/10' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">{exp.title}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider ${
                                  type === 'lent' ? 'bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/10' :
                                  type === 'received' ? 'bg-gold-400/10 text-gold-400 border border-gold-400/10' :
                                  type === 'borrowed' ? 'bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/10' :
                                  type === 'repaid' ? 'bg-white/10 text-white border border-white/10' :
                                  isSelf ? 'bg-white/5 text-[#8A8A8A] border border-white/5' :
                                  'bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/10'
                                }`}>
                                  {type === 'lent' ? 'Lent' :
                                   type === 'received' ? 'Received (Back)' :
                                   type === 'borrowed' ? 'Borrowed' :
                                   type === 'repaid' ? 'Repaid' :
                                   isSelf ? 'Personal Expense' : 'Expense (Lent)'}
                                </span>
                                {totalRepayments > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider bg-gold-400/10 text-gold-400 border border-gold-400/15">
                                    Partially Paid (₹{totalRepayments})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[#555555]">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <span>·</span>
                                <span>{exp.paymentMethod === 'UPI' && exp.upiApp ? `UPI (${exp.upiApp})` : exp.paymentMethod}</span>
                              </div>
                              {exp.notes && (
                                <p className="text-[11px] text-[#8A8A8A] font-light italic mt-0.5">&ldquo;{exp.notes}&rdquo;</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {isSelf && type === 'expense' ? (
                                <span className="font-semibold text-sm text-[#8A8A8A]">
                                  ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </span>
                              ) : (
                                <span className={`font-semibold text-sm ${isLentFlow ? 'text-[#4ADE80]' : 'text-[#FF5A5F]'}`}>
                                  {isOutflow ? '-' : '+'}₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLedgerItem(exp._id);
                                }}
                                className="p-1.5 text-[#555555] hover:text-[#FF5A5F] hover:bg-[#FF5A5F]/5 rounded-md transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded view for linked repayments */}
                          {isExpanded && (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="mt-4 pt-4 border-t border-white/[0.04] space-y-4 cursor-default animate-fadeIn"
                            >
                              {/* Outstanding indicator */}
                              <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl border border-white/[0.03]">
                                <span className="text-[10px] font-normal text-[#8A8A8A] uppercase tracking-wider">Remaining Outstanding</span>
                                <span className={`text-xs font-semibold ${isLentFlow ? 'text-[#4ADE80]' : 'text-[#FF5A5F]'}`}>
                                  ₹{Math.max(0, exp.amount - totalRepayments).toLocaleString('en-IN')} / ₹{exp.amount.toLocaleString('en-IN')}
                                </span>
                              </div>

                              {/* Repayments log list */}
                              <div className="space-y-2">
                                <span className="text-[9px] font-semibold text-[#555555] uppercase tracking-wider block">Repayment Log</span>
                                {!exp.repayments || exp.repayments.length === 0 ? (
                                  <p className="text-[11px] text-[#555555] font-light">No repayments recorded for this transaction yet.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {exp.repayments.map((rep, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg border border-white/[0.02]">
                                        <div className="text-[11px]">
                                          <span className="text-white font-medium">₹{rep.amount}</span>
                                          <span className="text-[#8A8A8A] ml-2">via {rep.paymentMethod === 'UPI' && rep.upiApp ? `UPI (${rep.upiApp})` : rep.paymentMethod}</span>
                                          <span className="text-[#555555] ml-2">({new Date(rep.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span>
                                          {rep.notes && <p className="text-[10px] text-[#8A8A8A] italic mt-0.5">&ldquo;{rep.notes}&rdquo;</p>}
                                        </div>
                                        <button
                                          onClick={() => handleDeleteRepayment(exp, idx)}
                                          className="p-1 hover:bg-[#FF5A5F]/5 text-[#555555] hover:text-[#FF5A5F] rounded-md transition-colors"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Form to add repayment */}
                              <form onSubmit={(e) => handleAddRepaymentSubmit(e, exp)} className="space-y-3 pt-2 border-t border-white/[0.03]">
                                <span className="text-[9px] font-semibold text-gold-400 uppercase tracking-wider block">Record Amount Received Back</span>
                                
                                {repaymentError && (
                                  <div className="rounded-lg bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2 text-[10px] text-[#FF5A5F]">
                                    {repaymentError}
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] font-normal uppercase tracking-wider text-[#8A8A8A] mb-1 block">Amount Received (₹)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      required
                                      placeholder="0.00"
                                      value={repaymentAmount}
                                      onChange={(e) => setRepaymentAmount(e.target.value)}
                                      className="w-full rounded-lg bg-black border border-white/[0.08] px-3 py-1.5 text-xs text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-normal uppercase tracking-wider text-[#8A8A8A] mb-1 block">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {(['Cash', 'UPI'] as const).map(method => (
                                        <button
                                          key={method}
                                          type="button"
                                          onClick={() => setRepaymentMethod(method)}
                                          className={`py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                                            repaymentMethod === method
                                              ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                                              : 'bg-black border-white/[0.08] text-[#8A8A8A] hover:text-white'
                                          }`}
                                        >
                                          {method}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] font-normal uppercase tracking-wider text-[#8A8A8A] mb-1 block">Date</label>
                                    <input
                                      type="date"
                                      required
                                      value={repaymentDate}
                                      onChange={(e) => setRepaymentDate(e.target.value)}
                                      className="w-full rounded-lg bg-black border border-white/[0.08] px-3 py-1.5 text-xs text-white focus:border-gold-400/40 focus:outline-none transition-all"
                                    />
                                  </div>
                                  {repaymentMethod === 'UPI' && (
                                    <div>
                                      <label className="text-[9px] font-normal uppercase tracking-wider text-gold-400 mb-1 block">UPI App</label>
                                      <select
                                        value={repaymentUpiApp}
                                        onChange={(e) => setRepaymentUpiApp(e.target.value as any)}
                                        className="w-full rounded-lg bg-black border border-white/[0.08] px-3 py-1.5 text-xs text-white focus:border-gold-400/40 focus:outline-none transition-all"
                                      >
                                        <option value="GPay">GPay</option>
                                        <option value="Amazon Pay">Amazon Pay</option>
                                        <option value="Cred UPI">Cred UPI</option>
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="text-[9px] font-normal uppercase tracking-wider text-[#8A8A8A] mb-1 block">Notes (Optional)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Partial recovery, final settle"
                                    value={repaymentNotes}
                                    onChange={(e) => setRepaymentNotes(e.target.value)}
                                    className="w-full rounded-lg bg-black border border-white/[0.08] px-3 py-1.5 text-xs text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none transition-all"
                                  />
                                </div>

                                <button
                                  type="submit"
                                  disabled={repaymentLoading}
                                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all disabled:opacity-50"
                                >
                                  {repaymentLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                  Record Amount Received
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PersonModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPerson(null);
        }}
        onSuccess={loadData}
        personToEdit={editingPerson}
        addPersonOffline={addPersonOffline}
      />
    </div>
  );
}
