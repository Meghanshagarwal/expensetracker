'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, RefreshCw, Upload, Download, Fuel, Utensils, Gauge, CalendarDays,
  CornerDownLeft, CornerUpRight, ArrowUpRight, ChevronDown,
  Archive, CircleDollarSign, Clock3
} from 'lucide-react';
import SpendingOverview from '@/components/SpendingOverview';
import './dashboard.css';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getLocalExpenses, getLocalPersons } from '@/lib/offlineDb';
import { Expense, Person, DashboardStats } from '@/types';
import ExpenseModal from '@/components/ExpenseModal';
import ExpenseTable from '@/components/ExpenseTable';
import { isSelfPerson } from '@/utils/person';

const CATEGORIES = [
  'Petrol', 'Food', 'Tea/Coffee', 'Travel', 'Shopping', 
  'Bills', 'Entertainment', 'Education', 'Medical', 'Family', 'Other'
];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card'];

const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(amount);

export default function DashboardPage() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(CATEGORIES);
  
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
    
    // Load dynamic categories from localStorage first, then fetch
    const local = localStorage.getItem('app_dropdown_settings');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed.categories)) {
          setDynamicCategories(parsed.categories);
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (navigator.onLine) {
      fetch('/api/settings')
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => {
          if (data && Array.isArray(data.categories)) {
            setDynamicCategories(data.categories);
            // Sync to local storage
            localStorage.setItem('app_dropdown_settings', JSON.stringify({
              categories: data.categories,
              upiApps: data.upiApps,
              upiAccounts: data.upiAccounts,
              sourceAccounts: data.sourceAccounts,
              vehicles: data.vehicles
            }));
          }
        })
        .catch(err => console.error('Failed to fetch categories:', err));
    }
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
    const todayStr = now.toDateString();

    let totalMonth = 0;
    let totalYear = 0;
    let today = 0;
    
    let petrolExpenses = 0;
    let foodExpenses = 0;

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
        const isSelf = isSelfPerson(personName);
        if (!isSelf) {
          loanType = 'lent';
        }
      }

      const totalRepayments = exp.repayments ? exp.repayments.reduce((sum, r) => sum + r.amount, 0) : 0;
      const outstandingAmount = Math.max(0, exp.amount - totalRepayments);

      // Track loan amounts per person
      if (loanType === 'lent' || loanType === 'borrowed' || loanType === 'received' || loanType === 'repaid') {
        if (!personNetMap.has(exp.personId)) {
          personNetMap.set(exp.personId, { lent: 0, borrowed: 0 });
        }
        const current = personNetMap.get(exp.personId)!;
        if (loanType === 'lent') {
          current.lent += outstandingAmount;
        } else if (loanType === 'received') {
          current.lent -= exp.amount;
        } else if (loanType === 'borrowed') {
          current.borrowed += outstandingAmount;
        } else if (loanType === 'repaid') {
          current.borrowed -= exp.amount;
        }
      }

      // Process standard spending statistics
      if (originalType === 'expense') {
        const expDate = new Date(exp.date);
        const expMonth = expDate.getMonth();
        const expYear = expDate.getFullYear();
        const expDayStr = expDate.toDateString();

        if (expMonth === currentMonth && expYear === currentYear) {
          totalMonth += exp.amount;
          thisMonthExpenses += exp.amount;

          if (exp.category === 'Petrol') petrolExpenses += exp.amount;
          if (exp.category === 'Food') foodExpenses += exp.amount;

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

    // Long-running average mileage (km/l), per vehicle then combined,
    // so occasional reserve-run noise averages out over many fills
    const vehicleFills = new Map<string, { km: number; litres: number }[]>();
    expenses.forEach(exp => {
      if (exp.category === 'Petrol' && exp.vehicle && typeof exp.km === 'number' && exp.litres) {
        if (!vehicleFills.has(exp.vehicle)) vehicleFills.set(exp.vehicle, []);
        vehicleFills.get(exp.vehicle)!.push({ km: exp.km, litres: exp.litres });
      }
    });

    let totalDistance = 0;
    let totalLitresUsed = 0;
    vehicleFills.forEach(fills => {
      const sorted = [...fills].sort((a, b) => a.km - b.km);
      for (let i = 1; i < sorted.length; i++) {
        const diff = sorted[i].km - sorted[i - 1].km;
        if (diff > 0 && sorted[i - 1].litres > 0) {
          totalDistance += diff;
          totalLitresUsed += sorted[i - 1].litres;
        }
      }
    });

    const avgMileage = totalLitresUsed > 0 ? totalDistance / totalLitresUsed : 0;

    return {
      totalMonth,
      totalYear,
      today,
      avgDaily,
      petrolExpenses,
      foodExpenses,
      avgMileage,
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to download backup');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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


  const syncStatus = !isOnline ? 'Offline · Cached' : isSyncing ? 'Syncing' : syncError ? 'Sync issue' : 'Sync now';
  const summary = [
    { label: 'Spent today', amount: stats.today, Icon: Clock3, color: 'mint' },
    { label: 'Spent this year', amount: stats.totalYear, Icon: CalendarDays, color: 'lavender' },
    { label: 'Owed to you', amount: stats.totalReceivable, Icon: CornerDownLeft, color: 'aqua' },
    { label: 'You owe', amount: stats.totalPayable, Icon: CornerUpRight, color: 'peach' },
  ];
  const details = [
    { label: 'Daily average', value: formatMoney(stats.avgDaily), Icon: CircleDollarSign },
    { label: 'Last month', value: formatMoney(stats.lastMonthExpenses), Icon: CalendarDays },
    { label: 'Largest expense', value: formatMoney(stats.highestExpense?.amount ?? 0), Icon: ArrowUpRight, title: stats.highestExpense?.title },
    { label: 'Average mileage', value: stats.avgMileage ? `${stats.avgMileage.toFixed(1)} km/l` : '—', Icon: Gauge },
  ];
  return (
    <div className="ft-dashboard">
      <header className="ft-intro">
        <div>
          <p className="ft-date">{now?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) || '\u00a0'}</p>
          <h1>Overview<span>.</span></h1>
        </div>
        <div className="ft-intro-actions">
          {isOnline ? <button type="button" className="ft-sync" aria-label={`${syncStatus}. Sync changes`} disabled={isSyncing}
            title={syncError || 'Sync changes'} onClick={triggerSync}>
            <i className={syncError ? 'ft-warning' : ''} /><span>{syncStatus}</span>
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          </button> : <span className="ft-sync" role="status"><i className="ft-warning" />{syncStatus}</span>}
          <button type="button" className="ft-add" onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}>
            <Plus size={18} aria-hidden="true" /> Add expense
          </button>
        </div>
      </header>
      <div className="ft-overview-grid">
        <SpendingOverview expenses={expenses} now={now} />
        <section className="ft-snapshot">
          <h2>At a glance</h2>
          <dl>
            {summary.map(({ label, amount, Icon, color }) => <div key={label}>
              <dt><span className={`ft-bubble ft-${color}`}><Icon size={17} aria-hidden="true" /></span>{label}</dt>
              <dd>{formatMoney(amount)}</dd>
            </div>)}
          </dl>
        </section>
      </div>
      <details className="ft-details">
        <summary>Spending details <ChevronDown size={16} /></summary>
        <div className="ft-detail-grid">
          {details.map(({ label, value, Icon, title }) => <div key={label} className="ft-detail-cell">
            <Icon size={16} aria-hidden="true" /><span>{label}</span><strong>{value}</strong>
            {title && <small>{title}</small>}
          </div>)}
          {[{ label: 'Petrol', value: stats.petrolExpenses, Icon: Fuel }, { label: 'Food', value: stats.foodExpenses, Icon: Utensils }].map(({ label, value, Icon }) =>
            <button key={label} type="button" className="ft-detail-cell" aria-pressed={selectedCategory === label}
              title={`Filter transactions by ${label}`} onClick={() => setSelectedCategory(prev => prev === label ? '' : label)}>
              <Icon size={16} aria-hidden="true" /><span>{label} this month</span><strong>{formatMoney(value)}</strong>
            </button>)}
        </div>
      </details>
      <section className="ft-ledger" aria-labelledby="ledger-title">
        <h2 id="ledger-title">Transactions</h2>
        <ExpenseTable expenses={expenses} persons={persons} categories={dynamicCategories} paymentMethods={PAYMENT_METHODS}
          onEdit={handleEdit} onDelete={handleDelete} selectedCategory={selectedCategory} onSelectedCategoryChange={setSelectedCategory} />
      </section>
      <section className="ft-utility">
        <Archive size={22} aria-hidden="true" />
        <div><h2>Backup &amp; restore</h2><p>Download or restore your expenses and people as a JSON file.</p></div>
        <div className="ft-utility-actions">
          <button type="button" onClick={handleExportBackup}><Download size={15} /> Download</button>
          <label className="ft-file"><Upload size={15} /> Restore<input type="file" accept=".json,application/json" aria-label="Restore backup file" onChange={handleImportBackup} /></label>
        </div>
      </section>
      <ExpenseModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
        onSuccess={loadData} expenseToEdit={editingExpense} persons={persons} categories={dynamicCategories}
        paymentMethods={PAYMENT_METHODS} addExpenseOffline={addExpenseOffline} addPersonOffline={addPersonOffline} expenses={expenses} />
    </div>
  );
}
