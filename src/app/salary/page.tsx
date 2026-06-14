'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, Calendar, CreditCard, Search, ArrowUpRight, 
  DollarSign, TrendingUp, BarChart3, Receipt
} from 'lucide-react';
import { getLocalExpenses, getLocalPersons } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Expense, Person } from '@/types';
import Navbar from '@/components/Navbar';

interface SalaryTransaction {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  type: 'direct' | 'card_settlement';
  paymentMethod: string;
  cardName?: string;
  notes?: string;
}

export default function SalaryAccountPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const { fetchAndCacheData } = useOfflineSync();

  const loadData = useCallback(async () => {
    const localExp = await getLocalExpenses();
    const localPer = await getLocalPersons();
    setExpenses(localExp);
    setPersons(localPer);

    if (navigator.onLine) {
      try {
        await fetchAndCacheData();
        const updatedExp = await getLocalExpenses();
        const updatedPer = await getLocalPersons();
        setExpenses(updatedExp);
        setPersons(updatedPer);
      } catch (err) {
        console.error('Failed to sync and load salary data:', err);
      }
    }
  }, [fetchAndCacheData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate standard expenses and credit card statement settlements funded by Salary Account
  const salaryTransactions = useMemo(() => {
    const list: SalaryTransaction[] = [];

    expenses.forEach(exp => {
      // 1. Standard expenses paid directly from Salary Account
      // Note: transactionType should be standard 'expense' or 'lent' and sourceAccount should be 'Salary Account'
      const isCard = exp.paymentMethod === 'Credit Card';
      
      if (!isCard && exp.sourceAccount === 'Salary Account') {
        list.push({
          id: exp._id,
          title: exp.title,
          amount: exp.amount,
          date: exp.date,
          category: exp.category,
          type: 'direct',
          paymentMethod: exp.paymentMethod,
          notes: exp.notes
        });
      }

      // 2. Credit card transactions that were settled using Salary Account
      // Note: cardPaidFrom === 'Salary Account' means the statement was paid from Salary Account
      if (exp.isCardPaid && exp.cardPaidFrom === 'Salary Account') {
        let cardName = 'Credit Card';
        if (exp.paymentMethod === 'Credit Card' && exp.creditCardIssuer) {
          cardName = exp.creditCardIssuer;
        } else if (exp.paymentMethod === 'UPI' && exp.upiLinkedAccount) {
          cardName = exp.upiLinkedAccount;
        }

        list.push({
          id: `${exp._id}_settle`,
          title: `CC Statement Settle: ${exp.title}`,
          amount: exp.amount,
          date: exp.cardPaidDate || exp.date,
          category: exp.category,
          type: 'card_settlement',
          paymentMethod: 'Salary Account Transfer',
          cardName: cardName,
          notes: exp.notes ? `Card payment notes: ${exp.notes}` : `Statement settlement for ${cardName}`
        });
      }
    });

    // Sort transactions by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

  // Compute stats for Salary Account
  const stats = useMemo(() => {
    let totalDebit = 0;
    let thisMonthDebit = 0;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    salaryTransactions.forEach(tx => {
      totalDebit += tx.amount;

      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
        thisMonthDebit += tx.amount;
      }
    });

    return { totalDebit, thisMonthDebit, count: salaryTransactions.length };
  }, [salaryTransactions]);

  // Categories list for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    salaryTransactions.forEach(tx => cats.add(tx.category));
    return ['All', ...Array.from(cats)];
  }, [salaryTransactions]);

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return salaryTransactions.filter(tx => {
      const matchesCategory = selectedCategory === 'All' || tx.category === selectedCategory;
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = query === '' || 
        tx.title.toLowerCase().includes(query) || 
        tx.category.toLowerCase().includes(query) || 
        (tx.notes && tx.notes.toLowerCase().includes(query)) ||
        (tx.cardName && tx.cardName.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [salaryTransactions, selectedCategory, searchQuery]);

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
              <Wallet className="h-8 w-8 text-gold-400" />
              Salary Account
            </h1>
            <p className="text-sm text-[#8A8A8A] mt-1">
              View and audit all transactions and statement payments funded by your Salary Account.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 md:min-w-[180px] shadow-luxury">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium block mb-1">
                Total Account Spent
              </span>
              <span className="text-2xl font-extrabold text-gold-400 tracking-tight">
                {formatRupee(stats.totalDebit)}
              </span>
            </div>
            
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 md:min-w-[180px] shadow-luxury">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium block mb-1">
                Spent This Month
              </span>
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {formatRupee(stats.thisMonthDebit)}
              </span>
            </div>
          </div>
        </div>

        {/* Transactions Panel Section */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 shadow-luxury">
          {/* Title & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.06] mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold-400 animate-pulse" />
              Salary Ledger ({filteredTransactions.length})
            </h2>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Search item, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black border border-white/[0.08] pl-10 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/10 focus:outline-none transition-all w-full sm:w-[220px]"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-black border border-white/[0.08] px-4 py-2 rounded-xl text-sm text-white focus:border-gold-400/40 focus:outline-none w-full sm:w-auto appearance-none pr-8 cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#8A8A8A]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-[#555555] text-sm">
                No salary account transactions found matching criteria.
              </div>
            ) : (
              filteredTransactions.map(tx => (
                <div
                  key={tx.id}
                  className="rounded-xl border border-white/[0.04] bg-[#151515] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#1C1C1C] transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <h3 className="font-semibold text-white text-base">
                        {tx.title}
                      </h3>
                      
                      <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/[0.04] text-[#8A8A8A]">
                        {tx.category}
                      </span>
                      
                      {tx.type === 'card_settlement' ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-gold-400/10 text-gold-400 font-semibold border border-gold-400/20 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Card Settle ({tx.cardName})
                        </span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/70 font-semibold border border-white/[0.08] flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          Direct Expense
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-[#8A8A8A]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(tx.date)}
                      </span>
                      {tx.notes && (
                        <span className="italic truncate max-w-[200px] sm:max-w-md text-[#555555]">
                          "{tx.notes}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-lg font-bold text-white">
                      -{formatRupee(tx.amount)}
                    </span>
                    <span className="text-[10px] text-[#555555]">
                      {tx.paymentMethod}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
