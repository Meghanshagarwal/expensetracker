'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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

  const allPersonStats = useMemo(() => {
    const statsMap = new Map<string, { count: number; totalExpenses: number; netLoan: number }>();

    expenses.forEach(exp => {
      const current = statsMap.get(exp.personId) || { count: 0, totalExpenses: 0, netLoan: 0 };
      current.count++;
      const type = exp.transactionType || 'expense';
      if (type === 'expense') {
        current.totalExpenses += exp.amount;
      } else if (type === 'lent') {
        current.netLoan += exp.amount;
      } else if (type === 'borrowed') {
        current.netLoan -= exp.amount;
      }
      statsMap.set(exp.personId, current);
    });

    return statsMap;
  }, [expenses]);

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
            const { count, totalExpenses, netLoan } = allPersonStats.get(person._id) || { count: 0, totalExpenses: 0, netLoan: 0 };
            const isTemp = person._id.startsWith('temp_');
            return (
              <div
                key={person._id}
                className="bg-[#111111] border border-white/[0.06] p-5 rounded-2xl flex flex-col justify-between hover:border-gold-400/20 transition-all duration-300 shadow-luxury hover:-translate-y-1"
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Total Share</span>
                      <p className="text-base font-semibold text-white mt-0.5">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-normal text-[#555555] tracking-luxury-wide">Udhaar Bal.</span>
                      {netLoan > 0 ? (
                        <p className="text-base font-semibold text-[#4ADE80] mt-0.5">Owes ₹{netLoan.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      ) : netLoan < 0 ? (
                        <p className="text-base font-semibold text-[#FF5A5F] mt-0.5 font-sans">You owe ₹{Math.abs(netLoan).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      ) : (
                        <p className="text-base font-medium text-[#555555] mt-0.5">Settled</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-1 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => handleEdit(person)}
                      className="p-2 hover:bg-white/[0.04] text-[#555555] hover:text-white rounded-lg transition-all"
                      disabled={isTemp}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(person._id)}
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
