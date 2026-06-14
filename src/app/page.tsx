'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Plus, Wifi, WifiOff, RefreshCw, Upload, Download, 
  Fuel, Utensils, Plane, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getLocalExpenses, getLocalPersons } from '@/lib/offlineDb';
import { Expense, Person, DashboardStats } from '@/types';
import ExpenseModal from '@/components/ExpenseModal';
import ExpenseTable from '@/components/ExpenseTable';

const CATEGORIES = [
  'Petrol', 'Food', 'Tea/Coffee', 'Travel', 'Shopping', 
  'Bills', 'Entertainment', 'Education', 'Medical', 'Family', 'Other'
];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  const {
    isOnline,
    isSyncing,
    syncError,
    triggerSync,
    fetchAndCacheData,
    addExpenseOffline,
    addPersonOffline,
  } = useOfflineSync();

  const loadData = useCallback(async () => {
    const localExp = await getLocalExpenses();
    const localPer = await getLocalPersons();
    setExpenses(localExp);
    setPersons(localPer);

    if (navigator.onLine) {
      await fetchAndCacheData();
      const updatedExp = await getLocalExpenses();
      const updatedPer = await getLocalPersons();
      setExpenses(updatedExp);
      setPersons(updatedPer);
    }
  }, [fetchAndCacheData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone || 
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);

    // Watch for standalone changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkStandalone();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    
    if (!navigator.onLine) {
      alert('Deleting expenses is currently disabled offline.');
      return;
    }

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        alert('Failed to delete expense');
      }
    } catch (e) {
      alert('Error connecting to server');
    }
  };

  const stats = useMemo<DashboardStats>(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];

    let totalMonth = 0;
    let totalYear = 0;
    let today = 0;
    
    let petrolExpenses = 0;
    let foodExpenses = 0;
    let travelExpenses = 0;

    let thisMonthExpenses = 0;
    let lastMonthExpenses = 0;
    let highestExpense: DashboardStats['highestExpense'] = null;

    const daysInMonthSoFar = now.getDate();

    // Sum up lent and borrowed per person
    const personNetMap = new Map<string, { lent: number; borrowed: number }>();
    persons.forEach(p => personNetMap.set(p._id, { lent: 0, borrowed: 0 }));

    const personMap = new Map(persons.map(p => [p._id, p.name]));

    expenses.forEach(exp => {
      const originalType = exp.transactionType || 'expense';
      let loanType = originalType;

      if (originalType === 'expense') {
        const personName = personMap.get(exp.personId) || '';
        const isSelf = personName.toLowerCase() === 'self' || personName.toLowerCase() === 'my self';
        if (!isSelf) {
          loanType = 'lent';
        }
      }

      // Track loan amounts per person
      if (loanType === 'lent' || loanType === 'borrowed' || loanType === 'received' || loanType === 'repaid') {
        if (!personNetMap.has(exp.personId)) {
          personNetMap.set(exp.personId, { lent: 0, borrowed: 0 });
        }
        const current = personNetMap.get(exp.personId)!;
        if (loanType === 'lent') {
          current.lent += exp.amount;
        } else if (loanType === 'received') {
          current.lent -= exp.amount;
        } else if (loanType === 'borrowed') {
          current.borrowed += exp.amount;
        } else if (loanType === 'repaid') {
          current.borrowed -= exp.amount;
        }
      }

      // Process standard spending statistics
      if (originalType === 'expense') {
        const expDate = new Date(exp.date);
        const expMonth = expDate.getMonth();
        const expYear = expDate.getFullYear();
        const expDayStr = exp.date.split('T')[0];

        if (expMonth === currentMonth && expYear === currentYear) {
          totalMonth += exp.amount;
          thisMonthExpenses += exp.amount;

          if (exp.category === 'Petrol') petrolExpenses += exp.amount;
          if (exp.category === 'Food') foodExpenses += exp.amount;
          if (exp.category === 'Travel') travelExpenses += exp.amount;

          if (!highestExpense || exp.amount > highestExpense.amount) {
            highestExpense = {
              title: exp.title,
              amount: exp.amount,
              date: exp.date,
            };
          }
        }

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        if (expMonth === lastMonth && expYear === lastMonthYear) {
          lastMonthExpenses += exp.amount;
        }

        if (expYear === currentYear) {
          totalYear += exp.amount;
        }

        if (expDayStr === todayStr) {
          today += exp.amount;
        }
      }
    });

    // Calculate total receivables and total payables
    let totalReceivable = 0;
    let totalPayable = 0;

    personNetMap.forEach(val => {
      const net = val.lent - val.borrowed;
      if (net > 0) {
        totalReceivable += net;
      } else if (net < 0) {
        totalPayable += Math.abs(net);
      }
    });

    const avgDaily = totalMonth / daysInMonthSoFar;

    return {
      totalMonth,
      totalYear,
      today,
      avgDaily,
      petrolExpenses,
      foodExpenses,
      travelExpenses,
      thisMonthExpenses,
      lastMonthExpenses,
      highestExpense,
      totalReceivable,
      totalPayable,
    };
  }, [expenses, persons]);

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Backup failed');
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `FinTrack_Backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to download backup');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Restoring backup will overwrite all current database records. Proceed?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData),
        });

        if (res.ok) {
          alert('Backup restored successfully!');
          loadData();
        } else {
          const errorData = await res.json();
          alert(errorData.error || 'Failed to restore backup');
        }
      } catch (err) {
        alert('Invalid file format. Please upload a valid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const monthDiff = stats.thisMonthExpenses - stats.lastMonthExpenses;
  const monthDiffPositive = monthDiff >= 0;

  return (
    <div className="space-y-8 text-white pb-12">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
          {getGreeting()}
        </h1>
        <p className="text-sm text-[#8A8A8A] font-light">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Connection Status — Minimal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#4ADE80]' : 'bg-gold-400 animate-pulse'}`} />
          <span className="text-xs text-[#8A8A8A] font-normal">
            {isOnline 
              ? isSyncing ? 'Syncing...' : syncError ? `Error: ${syncError}` : 'Synced'
              : 'Offline · Cached data'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#8A8A8A] hover:text-white border border-white/[0.06] rounded-lg hover:border-white/[0.12] transition-all disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
        </div>
      </div>



      {/* Premium Balance Card */}
      <div className="relative bg-[#111111] rounded-3xl p-6 sm:p-8 border border-white/[0.06] shadow-luxury overflow-hidden">
        {/* Subtle gold accent line at top */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
        
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[11px] text-[#8A8A8A] uppercase tracking-luxury-wide font-normal">This Month</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight font-sans">
              ₹{stats.totalMonth.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[#8A8A8A] font-light">
                Avg ₹{stats.avgDaily.toFixed(0)}/day
              </span>
              <span className="text-[#555555]">·</span>
              <div className={`flex items-center gap-0.5 text-xs ${monthDiffPositive ? 'text-[#FF5A5F]' : 'text-[#4ADE80]'}`}>
                {monthDiffPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>₹{Math.abs(monthDiff).toLocaleString('en-IN', { maximumFractionDigits: 0 })} vs last</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-[#555555] uppercase tracking-luxury-wide">Year</p>
              <p className="text-lg font-medium text-white mt-0.5">₹{stats.totalYear.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="w-px h-10 bg-white/[0.06]" />
            <div className="text-right">
              <p className="text-[10px] text-[#555555] uppercase tracking-luxury-wide">Today</p>
              <p className="text-lg font-medium text-white mt-0.5">₹{stats.today.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {/* Receivable */}
        <div className="bg-[#111111] rounded-2xl p-4 border border-white/[0.06]">
          <p className="text-[10px] text-[#555555] uppercase tracking-luxury-wide font-normal">Owed to You</p>
          <p className="text-xl font-semibold text-[#4ADE80] mt-1.5">
            ₹{stats.totalReceivable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Payable */}
        <div className="bg-[#111111] rounded-2xl p-4 border border-white/[0.06]">
          <p className="text-[10px] text-[#555555] uppercase tracking-luxury-wide font-normal">You Owe</p>
          <p className="text-xl font-semibold text-[#FF5A5F] mt-1.5">
            ₹{stats.totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Highest */}
        <div className="bg-[#111111] rounded-2xl p-4 border border-white/[0.06]">
          <p className="text-[10px] text-[#555555] uppercase tracking-luxury-wide font-normal">Highest</p>
          <p className="text-xl font-semibold text-white mt-1.5 truncate">
            ₹{stats.highestExpense ? stats.highestExpense.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
          </p>
          <p className="text-[10px] text-[#555555] truncate mt-0.5">
            {stats.highestExpense ? stats.highestExpense.title : 'No records'}
          </p>
        </div>
      </div>

      {/* Category Spending — Minimal Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 bg-[#111111] rounded-xl p-3.5 border border-white/[0.06]">
          <div className="h-9 w-9 rounded-lg bg-gold-400/8 flex items-center justify-center">
            <Fuel className="h-4 w-4 text-gold-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[9px] text-[#555555] uppercase tracking-luxury-wide">Petrol</p>
            <p className="text-sm font-medium text-white">₹{stats.petrolExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#111111] rounded-xl p-3.5 border border-white/[0.06]">
          <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center">
            <Utensils className="h-4 w-4 text-[#8A8A8A]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[9px] text-[#555555] uppercase tracking-luxury-wide">Food</p>
            <p className="text-sm font-medium text-white">₹{stats.foodExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#111111] rounded-xl p-3.5 border border-white/[0.06]">
          <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center">
            <Plane className="h-4 w-4 text-[#8A8A8A]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[9px] text-[#555555] uppercase tracking-luxury-wide">Travel</p>
            <p className="text-sm font-medium text-white">₹{stats.travelExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#111111] rounded-xl p-3.5 border border-white/[0.06]">
          <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center">
            <Calendar className="h-4 w-4 text-[#8A8A8A]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[9px] text-[#555555] uppercase tracking-luxury-wide">Last Month</p>
            <p className="text-sm font-medium text-white">₹{stats.lastMonthExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white tracking-tight">Transactions</h2>
          <button
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gold-400 hover:bg-gold-500 text-black rounded-xl text-xs font-medium transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>
        <ExpenseTable
          expenses={expenses}
          persons={persons}
          categories={CATEGORIES}
          paymentMethods={PAYMENT_METHODS}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* PWA Install Banner */}
      {!isStandalone && showInstallBanner && (
        <div className="relative bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-luxury overflow-hidden">
          {/* Subtle gold line at left side of banner */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold-400" />
          
          <div className="space-y-1 text-center md:text-left pl-2">
            <h3 className="text-sm font-semibold text-white">
              {isIOS ? 'Install on iPhone / iPad' : 'Install FinTrack App'}
            </h3>
            <p className="text-xs text-[#8A8A8A] font-light leading-relaxed">
              {isIOS 
                ? 'Tap the Share button in Safari, scroll down and select "Add to Home Screen".' 
                : deferredPrompt 
                  ? 'Add FinTrack to your home screen for quick offline access and a premium full-screen experience.'
                  : 'Tap your browser\'s menu button (three dots) and select "Install app" or "Add to Home screen" to install FinTrack.'}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-center">
            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="px-5 py-2.5 rounded-xl bg-gold-400 hover:bg-gold-500 text-black font-semibold text-xs transition-all whitespace-nowrap"
              >
                Install Now
              </button>
            )}
            <button
              onClick={() => setShowInstallBanner(false)}
              className="px-4 py-2.5 rounded-xl bg-black border border-white/[0.08] hover:border-white/[0.15] text-xs font-normal text-[#8A8A8A] hover:text-white transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Backup Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-white">Data Backup</h3>
          <p className="text-xs text-[#555555] font-light leading-relaxed">
            Download your entire database as a JSON file.
          </p>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black border border-white/[0.08] hover:border-gold-400/20 text-xs font-normal text-white transition-all"
          >
            <Download className="h-4 w-4 text-gold-400" strokeWidth={1.5} />
            <span>Download Backup</span>
          </button>
        </div>

        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-white">Restore</h3>
          <p className="text-xs text-[#555555] font-light leading-relaxed">
            Upload a JSON backup to restore your data. This overwrites all records.
          </p>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black border border-white/[0.08] hover:border-gold-400/20 text-xs font-normal cursor-pointer text-white transition-all">
            <Upload className="h-4 w-4 text-gold-400" strokeWidth={1.5} />
            <span>Select File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={loadData}
        expenseToEdit={editingExpense}
        persons={persons}
        categories={CATEGORIES}
        paymentMethods={PAYMENT_METHODS}
        addExpenseOffline={addExpenseOffline}
        addPersonOffline={addPersonOffline}
      />

      {/* Floating Action Button — Gold */}
      <button
        onClick={() => {
          setEditingExpense(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-24 md:bottom-8 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 hover:bg-gold-500 text-black shadow-gold-glow hover:shadow-gold-glow-lg hover:scale-105 active:scale-95 transition-all"
        title="Add Expense"
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </button>
    </div>
  );
}
