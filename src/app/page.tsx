'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Plus, Wifi, WifiOff, RefreshCw, Upload, Download, 
  Fuel, Utensils, Plane, TrendingUp, Calendar 
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

    expenses.forEach(exp => {
      const type = exp.transactionType || 'expense';

      // Track loan amounts per person
      if (type === 'lent' || type === 'borrowed') {
        if (!personNetMap.has(exp.personId)) {
          personNetMap.set(exp.personId, { lent: 0, borrowed: 0 });
        }
        const current = personNetMap.get(exp.personId)!;
        if (type === 'lent') {
          current.lent += exp.amount;
        } else {
          current.borrowed += exp.amount;
        }
      }

      // Process standard spending statistics
      if (type === 'expense') {
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

        if (!highestExpense || exp.amount > highestExpense.amount) {
          highestExpense = {
            title: exp.title,
            amount: exp.amount,
            date: exp.date,
          };
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

  return (
    <div className="space-y-6 text-white pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#1E293B]/40 border border-slate-700/50 rounded-2xl p-4 glass-card">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
              <Wifi className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <WifiOff className="h-5 w-5 animate-pulse" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-bold tracking-wide">
              {isOnline ? 'System Online' : 'System Offline (Viewing Cached)'}
            </h2>
            <p className="text-xs text-slate-400">
              {isSyncing 
                ? 'Syncing offline records...' 
                : syncError 
                ? `Sync error: ${syncError}` 
                : 'All records synchronized.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {isOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          )}
          <button
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(59,130,246,0.25)]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-blue-500/5 rounded-bl-full flex items-center justify-center text-blue-500/10 font-bold text-3xl select-none">
            M
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">This Month</p>
          <h3 className="text-2xl font-extrabold text-blue-400 mt-1 font-sans">₹{stats.totalMonth.toFixed(2)}</h3>
          <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            <span>Avg ₹{stats.avgDaily.toFixed(2)} / Day</span>
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-violet-500/5 rounded-bl-full flex items-center justify-center text-violet-500/10 font-bold text-3xl select-none">
            Y
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">This Year</p>
          <h3 className="text-2xl font-extrabold text-violet-400 mt-1 font-sans">₹{stats.totalYear.toFixed(2)}</h3>
          <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-violet-400" />
            <span>Total Annual Spending</span>
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center text-emerald-500/10 font-bold text-3xl select-none">
            T
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Today</p>
          <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 font-sans">₹{stats.today.toFixed(2)}</h3>
          <div className="text-[10px] text-slate-400 mt-2">
            <span>Expenses logged today</span>
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-red-500/5 rounded-bl-full flex items-center justify-center text-red-500/10 font-bold text-3xl select-none">
            H
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Highest Expense</p>
          <h3 className="text-xl font-extrabold text-red-400 mt-1 font-sans truncate pr-8">
            {stats.highestExpense ? `₹${stats.highestExpense.amount.toFixed(2)}` : '₹0.00'}
          </h3>
          <p className="text-[10px] text-slate-400 truncate mt-2">
            {stats.highestExpense ? stats.highestExpense.title : 'No records yet'}
          </p>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center text-emerald-500/10 font-bold text-3xl select-none">
            R
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Owed to You (उधार दिया)</p>
          <h3 className="text-2xl font-extrabold text-emerald-400 mt-1 font-sans">₹{stats.totalReceivable.toFixed(2)}</h3>
          <div className="text-[10px] text-slate-400 mt-2">
            <span>Money people owe you</span>
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-bl-full flex items-center justify-center text-amber-500/10 font-bold text-3xl select-none">
            P
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">You Owe (उधार लिया)</p>
          <h3 className="text-2xl font-extrabold text-amber-400 mt-1 font-sans">₹{stats.totalPayable.toFixed(2)}</h3>
          <div className="text-[10px] text-slate-400 mt-2">
            <span>Money you need to pay back</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1E293B]/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Fuel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Petrol (Month)</p>
            <h4 className="text-sm font-bold text-white">₹{stats.petrolExpenses.toFixed(2)}</h4>
          </div>
        </div>

        <div className="bg-[#1E293B]/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Food (Month)</p>
            <h4 className="text-sm font-bold text-white">₹{stats.foodExpenses.toFixed(2)}</h4>
          </div>
        </div>

        <div className="bg-[#1E293B]/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Travel (Month)</p>
            <h4 className="text-sm font-bold text-white">₹{stats.travelExpenses.toFixed(2)}</h4>
          </div>
        </div>

        <div className="bg-[#1E293B]/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase font-sans">Month vs Last</p>
            <h4 className="text-xs font-bold text-white truncate">
              {stats.thisMonthExpenses >= stats.lastMonthExpenses ? '+' : '-'}
              ₹{Math.abs(stats.thisMonthExpenses - stats.lastMonthExpenses).toFixed(0)}
            </h4>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-[#1E293B]/50 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-700/10 text-slate-400 flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Last Month</p>
            <h4 className="text-sm font-bold text-slate-300">₹{stats.lastMonthExpenses.toFixed(2)}</h4>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
          <span>Transactions History</span>
        </h2>
        <ExpenseTable
          expenses={expenses}
          persons={persons}
          categories={CATEGORIES}
          paymentMethods={PAYMENT_METHODS}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1E293B]/40 border border-slate-700/50 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold tracking-wide">Data Backups</h3>
          <p className="text-xs text-slate-400">
            Download your entire transactions and people database schema locally as a JSON backup file.
          </p>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-xs font-bold transition-all text-white"
          >
            <Download className="h-4 w-4 text-blue-400" />
            <span>Download Backup (JSON)</span>
          </button>
        </div>

        <div className="bg-[#1E293B]/40 border border-slate-700/50 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold tracking-wide">Restore Database</h3>
          <p className="text-xs text-slate-400">
            Restore database records by uploading a valid JSON backup file. This will overwrite current records.
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer text-white">
              <Upload className="h-4 w-4 text-violet-400" />
              <span>Select Backup File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
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

      <button
        onClick={() => {
          setEditingExpense(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-24 md:bottom-8 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all"
        title="Add Expense"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}
