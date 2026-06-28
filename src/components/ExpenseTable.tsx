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
  selectedCategory?: string;
  onSelectedCategoryChange?: (category: string) => void;
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
  selectedCategory: controlledCategory,
  onSelectedCategoryChange: setControlledCategory,
}: ExpenseTableProps) {
  const [search, setSearch] = useState('');
  const [localSelectedCategory, setLocalSelectedCategory] = useState('');

  const selectedCategory = controlledCategory !== undefined ? controlledCategory : localSelectedCategory;
  const setSelectedCategory = (value: string) => {
    if (setControlledCategory) {
      setControlledCategory(value);
    } else {
      setLocalSelectedCategory(value);
    }
    setCurrentPage(1);
  };
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const personMap = useMemo(() => new Map(persons.map(p => [p._id, p.name])), [persons]);

  const processedExpenses = useMemo(() => {
    let result = expenses.filter(exp => exp.transactionType !== 'received' && exp.transactionType !== 'repaid');

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        exp =>
          exp.title.toLowerCase().includes(q) ||
          (personMap.get(exp.personId) || '').toLowerCase().includes(q) ||
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
  }, [expenses, search, selectedCategory, selectedPerson, selectedMethod, selectedType, sortField, sortOrder, personMap]);

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
    if (exp.sourceAccount === 'Salary Account') {
      return 'Salary';
    }
    if (exp.paymentMethod === 'UPI' && exp.upiApp) {
      return `UPI (${exp.upiApp}${exp.upiLinkedAccount ? ` - ${exp.upiLinkedAccount}` : ''})`;
    }
    if (exp.paymentMethod === 'Credit Card' && exp.creditCardIssuer) {
      return `CC (${exp.creditCardIssuer})`;
    }
    return exp.paymentMethod;
  };

  const getAmountColor = (exp: Expense) => {
    if (exp.transactionType === 'lent') return 'text-[#4ADE80]';
    if (exp.transactionType === 'borrowed') return 'text-[#FF5A5F]';
    return 'text-white';
  };

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl bg-[#0A0A0A] border border-white/[0.08] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none transition-colors"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-[#0A0A0A] border border-white/[0.08] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none transition-colors"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Person Filter */}
        <select
          value={selectedPerson}
          onChange={(e) => {
            setSelectedPerson(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-[#0A0A0A] border border-white/[0.08] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none transition-colors"
        >
          <option value="">All People</option>
          {persons.map(p => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        {/* Payment Method Filter */}
        <select
          value={selectedMethod}
          onChange={(e) => {
            setSelectedMethod(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-[#0A0A0A] border border-white/[0.08] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none transition-colors"
        >
          <option value="">All Methods</option>
          {paymentMethods.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Transaction Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl bg-[#0A0A0A] border border-white/[0.08] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none transition-colors"
        >
          <option value="">All Types</option>
          <option value="expense">Expenses Only</option>
          <option value="lent">Lent Only</option>
          <option value="borrowed">Borrowed Only</option>
        </select>

        {/* Export Buttons */}
        <div className="flex gap-2 justify-end sm:justify-start">
          <button
            onClick={() => exportToPDF(processedExpenses, persons)}
            title="Export PDF"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#111111] text-white border border-white/[0.08] hover:border-gold-400/30 hover:text-gold-400 rounded-xl text-xs font-medium transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => exportToExcel(processedExpenses, persons)}
            title="Export Excel"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#111111] text-white border border-white/[0.08] hover:border-gold-400/30 hover:text-gold-400 rounded-xl text-xs font-medium transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => exportToCSV(processedExpenses, persons)}
            title="Export CSV"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#111111] text-white border border-white/[0.08] hover:border-gold-400/30 hover:text-gold-400 rounded-xl text-xs font-medium transition-all"
          >
            <FileDown className="h-4 w-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111111]">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs font-normal tracking-wider text-[#8A8A8A] uppercase">
                <th className="py-3.5 px-4 cursor-pointer hover:text-gold-400 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1.5">
                    Date <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Title</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 cursor-pointer hover:text-gold-400 transition-colors" onClick={() => handleSort('amount')}>
                  <div className="flex items-center gap-1.5">
                    Amount <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Person</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#555555]">
                    No transactions found matching the criteria.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map(exp => (
                  <tr key={exp._id} className="bg-transparent hover:bg-white/[0.02] border-b border-white/[0.04] transition-colors">
                    <td className="py-3.5 px-4 text-[#8A8A8A] font-medium">{formatDate(exp.date)}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-medium text-white flex flex-wrap items-center gap-1.5">
                          {exp.title}
                          {exp.isPendingSync && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-gold-400/15 text-gold-400 border border-gold-400/25 font-semibold whitespace-nowrap">
                              Sync Pending
                            </span>
                          )}
                          {exp.vehicle && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-white/[0.04] text-[#8A8A8A] border border-white/[0.08] font-bold uppercase tracking-wider whitespace-nowrap">
                              {exp.vehicle}{exp.km ? ` (${exp.km} km)` : ''}
                            </span>
                          )}
                          {exp.litres && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 font-bold whitespace-nowrap">
                              {exp.litres.toFixed(2)} L
                            </span>
                          )}
                          {exp.mileage && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-gold-400/10 text-gold-400 border border-gold-400/20 font-bold ml-1 whitespace-nowrap">
                              {exp.mileage.toFixed(1)} km/l
                            </span>
                          )}
                          {exp.transactionType === 'lent' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 font-bold uppercase tracking-wider whitespace-nowrap">
                              Lent
                            </span>
                          )}
                          {exp.transactionType === 'borrowed' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20 font-bold uppercase tracking-wider whitespace-nowrap">
                              Borrowed
                            </span>
                          )}
                        </div>
                        {exp.notes && <div className="text-xs text-[#555555] mt-0.5">{exp.notes}</div>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block bg-white/[0.04] text-[#8A8A8A] rounded-lg px-2 py-0.5 text-xs">
                        {exp.category}
                      </span>
                    </td>
                    <td className={`py-3.5 px-4 font-medium ${getAmountColor(exp)}`}>₹{exp.amount.toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="text-white font-medium">{personMap.get(exp.personId) || 'Unknown'}</div>
                        <div className="text-[10px] text-[#555555] font-medium">
                          {exp.transactionType === 'borrowed' ? 'Dest: ' : 'Src: '}
                          {exp.sourceAccount || 'Self Account'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#8A8A8A] font-medium">{renderPaymentMethodDetail(exp)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => onEdit(exp)}
                          className="p-2 text-[#555555] hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                          disabled={exp.isPendingSync}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(exp._id)}
                          className="p-2 text-[#555555] hover:text-[#FF5A5F] hover:bg-[#FF5A5F]/5 rounded-lg transition-all"
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
        <div className="md:hidden divide-y divide-white/[0.04]">
          {paginatedExpenses.length === 0 ? (
            <div className="py-16 text-center text-[#555555] text-sm">
              No transactions found.
            </div>
          ) : (
            paginatedExpenses.map(exp => (
              <div key={exp._id} className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-white flex flex-wrap items-center gap-1.5">
                      {exp.title}
                      {exp.isPendingSync && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-gold-400/15 text-gold-400 border border-gold-400/25 whitespace-nowrap">
                          Pending
                        </span>
                      )}
                      {exp.vehicle && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-white/[0.04] text-[#8A8A8A] border border-white/[0.08] font-bold uppercase tracking-wider whitespace-nowrap">
                          {exp.vehicle}{exp.km ? ` (${exp.km} km)` : ''}
                        </span>
                      )}
                      {exp.litres && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 font-bold whitespace-nowrap">
                          {exp.litres.toFixed(2)} L
                        </span>
                      )}
                      {exp.mileage && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-gold-400/10 text-gold-400 border border-gold-400/20 font-bold ml-1 whitespace-nowrap">
                          {exp.mileage.toFixed(1)} km/l
                        </span>
                      )}
                      {exp.transactionType === 'lent' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 font-bold uppercase tracking-wider whitespace-nowrap">
                          Lent
                        </span>
                      )}
                      {exp.transactionType === 'borrowed' && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20 font-bold uppercase tracking-wider whitespace-nowrap">
                          Borrowed
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#555555] mt-0.5">{formatDate(exp.date)}</div>
                  </div>
                  <div className={`font-bold text-base ${getAmountColor(exp)}`}>₹{exp.amount.toFixed(2)}</div>
                </div>

                <div className="flex flex-wrap gap-2 items-center justify-between text-xs pt-1">
                  <div className="flex gap-2 items-center">
                    <span className="bg-white/[0.04] text-[#8A8A8A] rounded-lg px-2 py-0.5 text-[11px]">
                      {exp.category}
                    </span>
                    <span className="text-[#8A8A8A] font-medium">
                      {exp.transactionType === 'borrowed' ? 'From: ' : exp.transactionType === 'lent' ? 'To: ' : 'For: '}
                      <strong className="text-white">{personMap.get(exp.personId) || 'Unknown'}</strong> 
                      <span className="text-[10px] text-[#555555]"> ({exp.transactionType === 'borrowed' ? 'Dest: ' : 'Src: '}{exp.sourceAccount || 'Self'})</span>
                    </span>
                  </div>
                  <span className="text-[#555555] font-medium">
                    Via: <strong className="text-[#8A8A8A]">{renderPaymentMethodDetail(exp)}</strong>
                  </span>
                </div>

                {exp.notes && (
                  <p className="text-xs text-[#555555] italic bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                    {exp.notes}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.04]">
                  <button
                    onClick={() => onEdit(exp)}
                    className="flex items-center gap-1 text-xs font-medium text-[#555555] hover:text-white transition-colors"
                    disabled={exp.isPendingSync}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(exp._id)}
                    className="flex items-center gap-1 text-xs font-medium text-[#555555] hover:text-[#FF5A5F] transition-colors"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-[#8A8A8A]">
            Showing Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong> <span className="text-[#555555]">({processedExpenses.length} items)</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-lg bg-[#111111] border border-white/[0.08] text-[#8A8A8A] hover:border-gold-400/30 hover:text-white transition-colors disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-[#8A8A8A]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-lg bg-[#111111] border border-white/[0.08] text-[#8A8A8A] hover:border-gold-400/30 hover:text-white transition-colors disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-[#8A8A8A]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
