'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Edit2, Trash2, User } from 'lucide-react';
import { getLocalPersons, getLocalExpenses } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Person, Expense } from '@/types';
import PersonModal from '@/components/PersonModal';

export default function PeoplePage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const {
    addPersonOffline,
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

  const personStats = useCallback((personId: string) => {
    let count = 0;
    let totalExpenses = 0;
    let totalLent = 0;
    let totalBorrowed = 0;

    expenses.forEach(exp => {
      if (exp.personId === personId) {
        count++;
        const type = exp.transactionType || 'expense';
        if (type === 'expense') {
          totalExpenses += exp.amount;
        } else if (type === 'lent') {
          totalLent += exp.amount;
        } else if (type === 'borrowed') {
          totalBorrowed += exp.amount;
        }
      }
    });

    const netLoan = totalLent - totalBorrowed;

    return { count, totalExpenses, netLoan };
  }, [expenses]);

  return (
    <div className="space-y-6 text-white pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-fuchsia-500 flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">People Management</h1>
            <p className="text-xs text-slate-400">Manage individuals and groups linked to expenses</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingPerson(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-fuchsia-500 hover:from-primary-dark hover:to-fuchsia-600 rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(139,92,246,0.25)]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Person</span>
        </button>
      </div>

      {persons.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-slate-400">
          No persons recorded. Create a person to assign expenses to them.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map(person => {
            const { count, totalExpenses, netLoan } = personStats(person._id);
            const isTemp = person._id.startsWith('temp_');
            return (
              <div
                key={person._id}
                className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-border">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {person.name}
                        {isTemp && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Offline
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">
                        {count === 0 ? 'No transactions' : `${count} transactions`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Share</span>
                      <p className="text-sm font-extrabold text-primary mt-0.5">₹{totalExpenses.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Udhaar Bal.</span>
                      {netLoan > 0 ? (
                        <p className="text-sm font-extrabold text-emerald-400 mt-0.5">Owes ₹{netLoan.toFixed(2)}</p>
                      ) : netLoan < 0 ? (
                        <p className="text-sm font-extrabold text-rose-400 mt-0.5">You owe ₹{Math.abs(netLoan).toFixed(2)}</p>
                      ) : (
                        <p className="text-sm font-bold text-slate-500 mt-0.5">Settled</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-1 pt-2 border-t border-border/20">
                    <button
                      onClick={() => handleEdit(person)}
                      className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                      disabled={isTemp}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(person._id)}
                      className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-all"
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
