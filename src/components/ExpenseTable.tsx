'use client';

import { useState, useMemo } from 'react';
import { 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, 
  Edit2, Trash2, FileSpreadsheet, FileText, FileDown 
} from 'lucide-react';
import { Expense, Person } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';

interface ExpenseTableProps {
  expenses: Expense[];
  persons: Person[];
  categories: string[];
  paymentMethods: string[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

type SortField = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

export default function ExpenseTable({
  expenses,
  persons,
  categories,
  paymentMethods,
  onEdit,
  onDelete,
}: ExpenseTableProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const personMap = useMemo(() => new Map(persons.map(p => [p._id, p.name])), [persons]);

  const processedExpenses = useMemo(() => {
    let result = [...expenses];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        exp =>
          exp.title.toLowerCase().includes(q) ||
          (exp.notes && exp.notes.toLowerCase().includes(q)) ||
          (exp.vehicle && exp.vehicle.toLowerCase().includes(q)) ||
          (exp.upiApp && exp.upiApp.toLowerCase().includes(q)) ||
          (exp.upiLinkedAccount && exp.upiLinkedAccount.toLowerCase().includes(q)) ||
          (exp.creditCardIssuer && exp.creditCardIssuer.toLowerCase().includes(q)) ||
          (exp.sourceAccount && exp.sourceAccount.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      result = result.filter(exp => exp.category === selectedCategory);
    }

    if (selectedPerson) {
      result = result.filter(exp => exp.personId === selectedPerson);
    }

    if (selectedMethod) {
      result = result.filter(exp => exp.paymentMethod === selectedMethod);
    }

    if (selectedType) {
      result = result.filter(exp => (exp.transactionType || 'expense') === selectedType);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [expenses, search, selectedCategory, selectedPerson, selectedMethod, sortField, sortOrder]);

  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedExpenses.slice(startIndex, startIndex + itemsPerPage);
  }, [processedExpenses, currentPage]);

  const totalPages = Math.max(1, Math.ceil(processedExpenses.length / itemsPerPage));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderPaymentMethodDetail = (exp: Expense) => {
    if (exp.paymentMethod === 'UPI' && exp.upiApp) {
      return `UPI (${exp.upiApp}${exp.upiLinkedAccount ? ` - ${exp.upiLinkedAccount}` : ''})`;
    }
    if (exp.paymentMethod === 'Credit Card' && exp.creditCardIssuer) {
      return `CC (${exp.creditCardIssuer})`;
    }
    return exp.paymentMethod;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl bg-slate-900 border border-border pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-slate-900 border border-border px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={selectedPerson}
          onChange={(e) => {
            setSelectedPerson(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-slate-900 border border-border px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
        >
          <option value="">All People</option>
          {persons.map(p => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <select
          value={selectedMethod}
          onChange={(e) => {
            setSelectedMethod(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-slate-900 border border-border px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
        >
          <option value="">All Methods</option>
          {paymentMethods.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-slate-900 border border-border px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors text-white"
        >
          <option value="">All Types</option>
          <option value="expense">Expenses Only</option>
          <option value="lent">Lent Only</option>
          <option value="borrowed">Borrowed Only</option>
        </select>

        <div className="flex gap-2 justify-end sm:justify-start">
          <button
            onClick={() => exportToPDF(processedExpenses, persons)}
            title="Export PDF"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-semibold transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => exportToExcel(processedExpenses, persons)}
            title="Export Excel"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-xs font-semibold transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => exportToCSV(processedExpenses, persons)}
            title="Export CSV"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-semibold transition-all"
          >
            <FileDown className="h-4 w-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-md">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-800/40 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1.5">
                    Date <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Title</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('amount')}>
                  <div className="flex items-center gap-1.5">
                    Amount <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Person</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No transactions found matching the criteria.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium">{formatDate(exp.date)}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">
                          {exp.title}
                          {exp.isPendingSync && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                              Sync Pending
                            </span>
                          )}
                          {exp.vehicle && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-primary/10 text-primary/80 border border-primary/20 font-bold uppercase tracking-wider">
                              {exp.vehicle}
                            </span>
                          )}
                          {exp.transactionType === 'lent' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                              Lent
                            </span>
                          )}
                          {exp.transactionType === 'borrowed' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
                              Borrowed
                            </span>
                          )}
                        </div>
                        {exp.notes && <div className="text-xs text-slate-400 mt-0.5">{exp.notes}</div>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block rounded-full bg-slate-700/50 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-primary">₹{exp.amount.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="text-slate-300 font-medium">{personMap.get(exp.personId) || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          {exp.transactionType === 'borrowed' ? 'Dest: ' : 'Src: '}
                          {exp.sourceAccount || 'Self Account'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">{renderPaymentMethodDetail(exp)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => onEdit(exp)}
                          className="p-2 hover:bg-slate-700/60 text-slate-400 hover:text-white rounded-lg transition-all"
                          disabled={exp.isPendingSync}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(exp._id)}
                          className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                          disabled={exp.isPendingSync}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Layout */}
        <div className="md:hidden divide-y divide-slate-800">
          {paginatedExpenses.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No transactions found.
            </div>
          ) : (
            paginatedExpenses.map(exp => (
              <div key={exp._id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white flex flex-wrap items-center gap-1.5">
                      {exp.title}
                      {exp.isPendingSync && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Pending
                        </span>
                      )}
                      {exp.vehicle && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-primary/15 text-primary/80 border border-primary/20 font-bold uppercase tracking-wider">
                          {exp.vehicle}
                        </span>
                      )}
                      {exp.transactionType === 'lent' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                          Lent
                        </span>
                      )}
                      {exp.transactionType === 'borrowed' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
                          Borrowed
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatDate(exp.date)}</div>
                  </div>
                  <div className="font-extrabold text-primary text-base">₹{exp.amount.toFixed(2)}</div>
                </div>

                <div className="flex flex-wrap gap-2 items-center justify-between text-xs pt-1">
                  <div className="flex gap-2 items-center">
                    <span className="rounded-full bg-slate-700/50 px-2.5 py-0.5 text-[11px] text-slate-300 font-semibold">
                      {exp.category}
                    </span>
                    <span className="text-slate-400 font-medium">
                      {exp.transactionType === 'borrowed' ? 'From: ' : exp.transactionType === 'lent' ? 'To: ' : 'For: '}
                      <strong className="text-slate-200">{personMap.get(exp.personId) || 'Unknown'}</strong> 
                      <span className="text-[10px] text-slate-500"> ({exp.transactionType === 'borrowed' ? 'Dest: ' : 'Src: '}{exp.sourceAccount || 'Self'})</span>
                    </span>
                  </div>
                  <span className="text-slate-400 font-medium">
                    Via: <strong className="text-slate-200">{renderPaymentMethodDetail(exp)}</strong>
                  </span>
                </div>

                {exp.notes && (
                  <p className="text-xs text-slate-400 italic bg-slate-900/30 p-2 rounded-lg border border-border/40">
                    {exp.notes}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-border/40">
                  <button
                    onClick={() => onEdit(exp)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white"
                    disabled={exp.isPendingSync}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(exp._id)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-400"
                    disabled={exp.isPendingSync}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-white">
          <p className="text-xs text-slate-400">
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (Total {processedExpenses.length} items)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-border/60 hover:bg-slate-900 transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-border/60 hover:bg-slate-900 transition-colors disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
