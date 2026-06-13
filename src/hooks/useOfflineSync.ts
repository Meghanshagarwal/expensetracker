import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getLocalExpenses,
  getLocalPersons,
  saveLocalExpenses,
  saveLocalPersons,
  getSyncQueue,
  removeFromSyncQueue,
  addToSyncQueue
} from '@/lib/offlineDb';
import { Expense, Person } from '@/types';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const syncInProgressRef = useRef(false);

  // Fetch and cache data from server
  const fetchAndCacheData = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const [expRes, perRes] = await Promise.all([
          fetch('/api/expenses'),
          fetch('/api/persons'),
        ]);

        if (expRes.ok && perRes.ok) {
          const expensesData = await expRes.json();
          const personsData = await perRes.json();

          await saveLocalExpenses(expensesData.expenses || expensesData);
          await saveLocalPersons(personsData.persons || personsData);
        }
      } catch (err) {
        console.error('Failed to update local cache from server:', err);
      }
    }
  }, []);

  // Sync function
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || syncInProgressRef.current) return;
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queue }),
      });

      if (!response.ok) {
        throw new Error('Failed to synchronize offline data');
      }

      await response.json();
      
      for (const item of queue) {
        await removeFromSyncQueue(item.tempId);
      }
      
      await fetchAndCacheData();
    } catch (err: any) {
      setSyncError(err.message || 'Sync failed');
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  }, [fetchAndCacheData]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      triggerSync();
      fetchAndCacheData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, fetchAndCacheData]);

  // Offline wrapper for adding expense
  const addExpenseOffline = async (expenseData: Omit<Expense, '_id' | 'createdAt'>) => {
    const tempId = `temp_exp_${Date.now()}`;
    const newExpense: Expense = {
      ...expenseData,
      _id: tempId,
      createdAt: new Date().toISOString(),
      isPendingSync: true,
    };

    const current = await getLocalExpenses();
    await saveLocalExpenses([newExpense, ...current]);
    await addToSyncQueue('expense', 'create', newExpense);

    if (navigator.onLine) {
      triggerSync();
    }
    return newExpense;
  };

  // Offline wrapper for adding person
  const addPersonOffline = async (name: string) => {
    const tempId = `temp_per_${Date.now()}`;
    const newPerson: Person = {
      _id: tempId,
      name,
      createdAt: new Date().toISOString(),
    };

    const current = await getLocalPersons();
    await saveLocalPersons([...current, newPerson]);
    await addToSyncQueue('person', 'create', newPerson);

    if (navigator.onLine) {
      triggerSync();
    }
    return newPerson;
  };

  return {
    isOnline,
    isSyncing,
    syncError,
    triggerSync,
    fetchAndCacheData,
    addExpenseOffline,
    addPersonOffline,
  };
}
