'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, CheckCircle2, XCircle, 
  Loader2, ArrowUpRight, Search, Undo2, Filter
} from 'lucide-react';
import { getLocalExpenses, saveLocalExpenses, addToSyncQueue } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Expense } from '@/types';
import Navbar from '@/components/Navbar';

type CardType = 'ICICI' | 'OneCard' | 'Yes Bank';

export default function CardsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardType>('OneCard');
  const [filterStatus, setFilterStatus] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Mark as Paid form inputs
  const [paidFrom, setPaidFrom] = useState<'Salary Account' | 'Self Account'>('Salary Account');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitLoading, setSubmitLoading] = useState(false);

  const { isOnline, fetchAndCacheData } = useOfflineSync();

  const loadData = useCallback(async () => {
    const localExp = await getLocalExpenses();
    setExpenses(localExp);

    if (navigator.onLine) {
      try {
        await fetchAndCacheData();
        const updatedExp = await getLocalExpenses();
        setExpenses(updatedExp);
      } catch (err) {
        console.error('Failed to sync and load card expenses:', err);
      }
    }
  }, [fetchAndCacheData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Card Transaction Matching Logic
  const getCardExpenses = useCallback((card: CardType, list: Expense[]) => {
    return list.filter(exp => {
      const isCC = exp.paymentMethod === 'Credit Card';
      const isUPI = exp.paymentMethod === 'UPI';

      if (card === 'ICICI') {
        return (isCC && exp.creditCardIssuer === 'ICICI') ||
               (isUPI && exp.upiLinkedAccount === 'ICICI Credit Card');
      }
      if (card === 'OneCard') {
        return (isCC && exp.creditCardIssuer === 'OneCard');
      }
      if (card === 'Yes Bank') {
        return (isCC && exp.creditCardIssuer === 'Yes Bank') ||
               (isUPI && exp.upiLinkedAccount === 'Yes Bank');
      }
      return false;
    });
  }, []);

  // Compute Metrics for each card
  const cardMetrics = useMemo(() => {
    const metrics = {
      OneCard: { spent: 0, outstanding: 0, paid: 0 },
      ICICI: { spent: 0, outstanding: 0, paid: 0 },
      'Yes Bank': { spent: 0, outstanding: 0, paid: 0 }
    };

    const cards: CardType[] = ['OneCard', 'ICICI', 'Yes Bank'];
    cards.forEach(card => {
      const txs = getCardExpenses(card, expenses);
      txs.forEach(t => {
        metrics[card].spent += t.amount;
        if (t.isCardPaid) {
          metrics[card].paid += t.amount;
        } else {
          metrics[card].outstanding += t.amount;
        }
      });
    });

    return metrics;
  }, [expenses, getCardExpenses]);

  // Total Outstanding across all cards
  const totalOutstandingAllCards = useMemo(() => {
    return cardMetrics.OneCard.outstanding + cardMetrics.ICICI.outstanding + cardMetrics['Yes Bank'].outstanding;
  }, [cardMetrics]);

  // Filtered transactions for the currently selected card
  const filteredTransactions = useMemo(() => {
    const cardTxs = getCardExpenses(selectedCard, expenses);
    
    return cardTxs.filter(tx => {
      // Apply status filter
      if (filterStatus === 'paid' && !tx.isCardPaid) return false;
      if (filterStatus === 'unpaid' && tx.isCardPaid) return false;

      // Apply search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const titleMatch = tx.title.toLowerCase().includes(query);
        const categoryMatch = tx.category.toLowerCase().includes(query);
        const notesMatch = tx.notes?.toLowerCase().includes(query) || false;
        return titleMatch || categoryMatch || notesMatch;
      }

      return true;
    });
  }, [selectedCard, expenses, filterStatus, searchQuery, getCardExpenses]);

  // Mark as Paid handler
  const handleMarkAsPaid = async (expense: Expense) => {
    if (submitLoading) return;
    setSubmitLoading(true);

    const updatedExpense: Expense = {
      ...expense,
      isCardPaid: true,
      cardPaidDate: new Date(paidDate).toISOString(),
      cardPaidFrom: paidFrom
    };

    try {
      if (!navigator.onLine) {
        // Offline Flow
        const current = await getLocalExpenses();
        const updated = current.map(e => e._id === expense._id ? updatedExpense : e);
        await saveLocalExpenses(updated);
        await addToSyncQueue('expense', 'update', updatedExpense);
        setExpenses(updated);
        setExpandedTxId(null);
      } else {
        // Online Flow
        const res = await fetch('/api/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: expense._id,
            isCardPaid: true,
            cardPaidDate: new Date(paidDate).toISOString(),
            cardPaidFrom: paidFrom
          })
        });

        if (res.ok) {
          await loadData();
          setExpandedTxId(null);
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to update transaction status');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error updating transaction status');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Revert / Mark as Unpaid handler
  const handleMarkAsUnpaid = async (expense: Expense) => {
    if (!window.confirm('Are you sure you want to mark this transaction as UNPAID?')) return;

    const updatedExpense: Expense = {
      ...expense,
      isCardPaid: false,
      cardPaidDate: undefined,
      cardPaidFrom: undefined
    };

    try {
      if (!navigator.onLine) {
        // Offline Flow
        const current = await getLocalExpenses();
        const updated = current.map(e => e._id === expense._id ? updatedExpense : e);
        await saveLocalExpenses(updated);
        await addToSyncQueue('expense', 'update', updatedExpense);
        setExpenses(updated);
      } else {
        // Online Flow
        const res = await fetch('/api/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: expense._id,
            isCardPaid: false,
            cardPaidDate: null,
            cardPaidFrom: null
          })
        });

        if (res.ok) {
          await loadData();
        } else {
          alert('Failed to update transaction status');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error updating transaction status');
    }
  };

  const formatRupee = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold-400 selection:text-black">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-32 md:pb-12">
        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-gold-400" />
              Cards Ledger
            </h1>
            <p className="text-sm text-[#8A8A8A] mt-1">
              Track outstanding balances and mark credit card statements as paid.
            </p>
          </div>
          
          <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 md:min-w-[280px] shadow-luxury">
            <span className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium block mb-1">
              Total Outstanding Balance
            </span>
            <span className="text-3xl font-extrabold text-gold-400 tracking-tight">
              {formatRupee(totalOutstandingAllCards)}
            </span>
          </div>
        </div>

        {/* 3 Premium Credit Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* ONECARD */}
          <motion.div
            whileHover={{ y: -6 }}
            onClick={() => {
              setSelectedCard('OneCard');
              setExpandedTxId(null);
            }}
            className={`cursor-pointer relative overflow-hidden rounded-2xl p-6 h-[200px] flex flex-col justify-between transition-all duration-300 select-none ${
              selectedCard === 'OneCard'
                ? 'bg-gradient-to-br from-[#121212] via-[#222222] to-[#0A0A0A] border-2 border-gold-400 shadow-[0_0_25px_rgba(212,175,55,0.12)]'
                : 'bg-gradient-to-br from-[#0D0D0D] to-[#141414] border border-white/[0.06] opacity-70 hover:opacity-95'
            }`}
          >
            {/* Card BG Accent */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-gold-400/5 rounded-full blur-2xl -mr-8 -mt-8" />
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-gold-400 tracking-widest uppercase">
                  ONECARD
                </span>
                <span className="block text-[9px] text-[#555555] uppercase mt-0.5">
                  Metal Edition
                </span>
              </div>
              <div className="w-10 h-7 bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded-md border border-amber-800/10 shadow-inner flex items-center justify-center overflow-hidden">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 opacity-30">
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider block">
                Outstanding Balance
              </span>
              <span className="text-2xl font-bold tracking-tight text-white mt-1 block">
                {formatRupee(cardMetrics.OneCard.outstanding)}
              </span>
            </div>

            <div className="flex justify-between items-end text-[10px] text-[#555555]">
              <span>•••• •••• •••• 1001</span>
              <span className="text-[#8A8A8A]">Total Spent: {formatRupee(cardMetrics.OneCard.spent)}</span>
            </div>
          </motion.div>

          {/* ICICI CARD */}
          <motion.div
            whileHover={{ y: -6 }}
            onClick={() => {
              setSelectedCard('ICICI');
              setExpandedTxId(null);
            }}
            className={`cursor-pointer relative overflow-hidden rounded-2xl p-6 h-[200px] flex flex-col justify-between transition-all duration-300 select-none ${
              selectedCard === 'ICICI'
                ? 'bg-gradient-to-br from-[#E75B3F] via-[#C93E23] to-[#7A1200] border-2 border-gold-400 shadow-[0_0_25px_rgba(212,175,55,0.12)]'
                : 'bg-gradient-to-br from-[#3D1A15] to-[#25100D] border border-white/[0.06] opacity-70 hover:opacity-95'
            }`}
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8" />

            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-white tracking-wider">
                  ICICI BANK
                </span>
                <span className="block text-[8px] text-white/60 tracking-wider uppercase mt-0.5">
                  Coral Credit Card
                </span>
              </div>
              <div className="w-10 h-7 bg-gradient-to-br from-slate-200 to-slate-400 rounded-md border border-slate-500/20 shadow-inner flex items-center justify-center overflow-hidden">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 opacity-40">
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-white/70 uppercase tracking-wider block">
                Outstanding Balance
              </span>
              <span className="text-2xl font-bold tracking-tight text-white mt-1 block">
                {formatRupee(cardMetrics.ICICI.outstanding)}
              </span>
            </div>

            <div className="flex justify-between items-end text-[10px] text-white/50">
              <span>•••• •••• •••• 4004</span>
              <span className="text-white/80">Total Spent: {formatRupee(cardMetrics.ICICI.spent)}</span>
            </div>
          </motion.div>

          {/* YES BANK */}
          <motion.div
            whileHover={{ y: -6 }}
            onClick={() => {
              setSelectedCard('Yes Bank');
              setExpandedTxId(null);
            }}
            className={`cursor-pointer relative overflow-hidden rounded-2xl p-6 h-[200px] flex flex-col justify-between transition-all duration-300 select-none ${
              selectedCard === 'Yes Bank'
                ? 'bg-gradient-to-br from-[#003C8F] via-[#002171] to-[#000A21] border-2 border-gold-400 shadow-[0_0_25px_rgba(212,175,55,0.12)]'
                : 'bg-gradient-to-br from-[#0A122C] to-[#05091B] border border-white/[0.06] opacity-70 hover:opacity-95'
            }`}
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-400/5 rounded-full blur-2xl -mr-8 -mt-8" />

            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-extrabold text-[#90CAF9] tracking-wider">
                  YES BANK
                </span>
                <span className="block text-[8px] text-[#90CAF9]/60 tracking-wider uppercase mt-0.5">
                  FinTech Mastercard
                </span>
              </div>
              <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-600 rounded-md border border-amber-800/10 shadow-inner flex items-center justify-center overflow-hidden">
                <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 opacity-30">
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                  <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#90CAF9]/80 uppercase tracking-wider block">
                Outstanding Balance
              </span>
              <span className="text-2xl font-bold tracking-tight text-white mt-1 block">
                {formatRupee(cardMetrics['Yes Bank'].outstanding)}
              </span>
            </div>

            <div className="flex justify-between items-end text-[10px] text-[#90CAF9]/50">
              <span>•••• •••• •••• 8008</span>
              <span className="text-[#90CAF9]/80">Total Spent: {formatRupee(cardMetrics['Yes Bank'].spent)}</span>
            </div>
          </motion.div>
        </div>

        {/* Transactions Panel Section */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 shadow-luxury">
          {/* Title & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.06] mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold-400 animate-pulse" />
              {selectedCard} Transactions ({filteredTransactions.length})
            </h2>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Search item, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black border border-white/[0.08] pl-10 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/10 focus:outline-none transition-all w-full sm:w-[220px]"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-black p-1 rounded-xl border border-white/[0.08]">
                {(['unpaid', 'paid', 'all'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterStatus(status);
                      setExpandedTxId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                      filterStatus === status
                        ? 'bg-gold-400/10 border border-gold-400/20 text-gold-400'
                        : 'text-[#8A8A8A] hover:text-white border border-transparent'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-[#555555] text-sm">
                No credit card transactions found matching criteria.
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const isExpanded = expandedTxId === tx._id;
                
                return (
                  <div
                    key={tx._id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded 
                        ? 'bg-black/50 border-gold-400/30 shadow-md' 
                        : tx.isCardPaid 
                          ? 'bg-transparent border-white/[0.03] hover:bg-white/[0.01]' 
                          : 'bg-[#151515] border-white/[0.06] hover:bg-[#1C1C1C]'
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => !tx.isCardPaid && setExpandedTxId(isExpanded ? null : tx._id)}
                      className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                        !tx.isCardPaid ? 'cursor-pointer select-none' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-semibold text-white text-base">
                            {tx.title}
                          </h3>
                          <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/[0.04] text-[#8A8A8A]">
                            {tx.category}
                          </span>
                          {tx.paymentMethod === 'UPI' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                              UPI ({tx.upiLinkedAccount})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#8A8A8A]">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(tx.date)}
                          </span>
                          {tx.notes && (
                            <span className="italic truncate max-w-[200px] sm:max-w-xs text-[#555555]">
                              "{tx.notes}"
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <span className={`text-lg font-bold ${tx.isCardPaid ? 'text-[#8A8A8A] line-through' : 'text-white'}`}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </span>

                        <div className="flex items-center gap-2">
                          {tx.isCardPaid ? (
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-green-400 bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                PAID
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsUnpaid(tx);
                                }}
                                className="p-1.5 rounded-lg bg-[#222222] border border-white/[0.05] text-[#8A8A8A] hover:text-white hover:bg-[#333333] transition-all"
                                title="Mark as Unpaid"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTxId(isExpanded ? null : tx._id);
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all flex items-center gap-1"
                            >
                              Mark Paid
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline Expandable Settlement Form */}
                    <AnimatePresence>
                      {isExpanded && !tx.isCardPaid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-white/[0.06] bg-[#0A0A0A] p-4"
                        >
                          <div className="max-w-xl space-y-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                              Statement Settlement Details
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                                  Paid From (Account)
                                </label>
                                <select
                                  value={paidFrom}
                                  onChange={(e) => setPaidFrom(e.target.value as any)}
                                  className="w-full rounded-xl bg-[#111111] border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                                >
                                  <option value="Salary Account">Salary Account</option>
                                  <option value="Self Account">Self Account</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                                  Payment Date
                                </label>
                                <input
                                  type="date"
                                  value={paidDate}
                                  onChange={(e) => setPaidDate(e.target.value)}
                                  className="w-full rounded-xl bg-[#111111] border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => setExpandedTxId(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8A8A8A] hover:text-white hover:bg-white/[0.02]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={submitLoading}
                                onClick={() => handleMarkAsPaid(tx)}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {submitLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                Confirm Settlement
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
