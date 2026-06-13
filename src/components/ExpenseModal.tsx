'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CreditCard } from 'lucide-react';
import { Expense, Person } from '@/types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expenseToEdit?: Expense | null;
  persons: Person[];
  categories: string[];
  paymentMethods: string[];
  addExpenseOffline: (expense: any) => Promise<any>;
  addPersonOffline: (name: string) => Promise<any>;
}

export default function ExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
  persons,
  categories,
  paymentMethods,
  addExpenseOffline,
  addPersonOffline,
}: ExpenseModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Food');
  const [transactionType, setTransactionType] = useState<'expense' | 'lent' | 'borrowed'>('expense');
  const [personId, setPersonId] = useState('');
  const [customPerson, setCustomPerson] = useState('');
  const [isCustomPersonActive, setIsCustomPersonActive] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [notes, setNotes] = useState('');

  // Conditional Fields States
  const [vehicle, setVehicle] = useState('Car');
  const [sourceAccount, setSourceAccount] = useState('Self Account');
  const [upiApp, setUpiApp] = useState('GPay');
  const [upiLinkedAccount, setUpiLinkedAccount] = useState('Yes Bank');
  const [creditCardIssuer, setCreditCardIssuer] = useState('ICICI');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine available UI options based on Salary Account constraint
  const visiblePaymentMethods = useMemo(() => {
    return sourceAccount === 'Salary Account'
      ? ['UPI']
      : transactionType === 'borrowed'
      ? ['Cash', 'UPI']
      : paymentMethods;
  }, [sourceAccount, transactionType, paymentMethods]);

  const visibleUpiApps = useMemo(() => {
    return sourceAccount === 'Salary Account' ? ['Cred UPI'] : ['GPay', 'Amazon Pay', 'Cred UPI'];
  }, [sourceAccount]);

  useEffect(() => {
    if (expenseToEdit) {
      setTitle(expenseToEdit.title);
      setAmount(expenseToEdit.amount.toString());
      setDate(new Date(expenseToEdit.date).toISOString().split('T')[0]);
      setCategory(expenseToEdit.category);
      setTransactionType(expenseToEdit.transactionType || 'expense');
      setPersonId(expenseToEdit.personId);
      setPaymentMethod(expenseToEdit.paymentMethod);
      setNotes(expenseToEdit.notes || '');
      setIsCustomPersonActive(false);
      setCustomPerson('');

      setVehicle(expenseToEdit.vehicle || 'Car');
      setSourceAccount(expenseToEdit.sourceAccount || 'Self Account');
      setUpiApp(expenseToEdit.upiApp || 'GPay');
      setUpiLinkedAccount(expenseToEdit.upiLinkedAccount || 'Yes Bank');
      setCreditCardIssuer(expenseToEdit.creditCardIssuer || 'ICICI');
    } else {
      setTitle('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('Food');
      setTransactionType('expense');
      setPersonId(persons[0]?._id || '');
      setPaymentMethod('UPI');
      setNotes('');
      setIsCustomPersonActive(false);
      setCustomPerson('');

      setVehicle('Car');
      setSourceAccount('Self Account');
      setUpiApp('GPay');
      setUpiLinkedAccount('Yes Bank');
      setCreditCardIssuer('ICICI');
    }
    setError(null);
  }, [expenseToEdit, isOpen, persons]);

  // Effect to handle Salary Account selection constraints
  useEffect(() => {
    if (sourceAccount === 'Salary Account') {
      setPaymentMethod('UPI');
      setUpiApp('Cred UPI');
    }
  }, [sourceAccount]);

  // Sync default options when conditional changes occur
  useEffect(() => {
    if (category === 'Petrol' && !vehicle) {
      setVehicle('Car');
    }
  }, [category, vehicle]);

  useEffect(() => {
    if (paymentMethod === 'UPI' && !upiApp) {
      setUpiApp('GPay');
    }
    if (paymentMethod === 'Credit Card' && !creditCardIssuer) {
      setCreditCardIssuer('ICICI');
    }
  }, [paymentMethod, upiApp, creditCardIssuer]);

  // Sync payment method if it becomes invalid under new constraints
  useEffect(() => {
    if (!visiblePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(visiblePaymentMethods[0] || 'UPI');
    }
  }, [visiblePaymentMethods, paymentMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || parseFloat(amount) <= 0) return;

    setLoading(true);
    setError(null);

    let resolvedPersonId = personId;

    try {
      if (isCustomPersonActive && customPerson.trim()) {
        if (!navigator.onLine) {
          const newPerson = await addPersonOffline(customPerson.trim());
          resolvedPersonId = newPerson._id;
        } else {
          const res = await fetch('/api/persons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: customPerson.trim() }),
          });
          if (!res.ok) throw new Error('Failed to create custom person');
          const newPerson = await res.json();
          resolvedPersonId = newPerson._id;
        }
      }

      if (!resolvedPersonId) {
        throw new Error('Please select or add a person for the expense.');
      }

      const expensePayload = {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
        transactionType,
        personId: resolvedPersonId,
        paymentMethod,
        date: new Date(date).toISOString(),
        notes: notes.trim(),

        // Conditional mappings
        vehicle: category === 'Petrol' ? vehicle : undefined,
        sourceAccount,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
        upiLinkedAccount: (paymentMethod === 'UPI' && upiApp) ? upiLinkedAccount : undefined,
        creditCardIssuer: paymentMethod === 'Credit Card' ? creditCardIssuer : undefined,
      };

      if (!navigator.onLine) {
        if (expenseToEdit) {
          setError('Offline editing is currently read-only. You can add new expenses offline.');
          setLoading(false);
          return;
        }
        await addExpenseOffline(expensePayload);
        onSuccess();
        onClose();
        return;
      }

      const url = '/api/expenses';
      const method = expenseToEdit ? 'PUT' : 'POST';
      const body = expenseToEdit 
        ? { id: expenseToEdit._id, ...expensePayload }
        : expensePayload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save expense');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Shared input class
  const inputClass =
    'w-full rounded-xl bg-black border border-white/[0.08] px-4 py-2.5 text-base md:text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/10 focus:outline-none transition-all';

  // Shared label class
  const labelClass =
    'block text-xs font-normal uppercase tracking-wider text-[#8A8A8A] mb-1.5';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full md:max-w-lg rounded-t-2xl md:rounded-2xl bg-[#111111] border-t md:border border-white/[0.06] p-6 pb-12 md:pb-6 text-white shadow-luxury z-10 max-h-[92vh] md:max-h-[90vh] overflow-y-auto"
          >
            {/* Mobile Sheet Handle */}
            <div className="w-12 h-1.5 bg-white/[0.12] rounded-full mx-auto mb-4 md:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2.5 text-white">
                <CreditCard className="h-5 w-5 text-gold-400" />
                {expenseToEdit ? 'Edit Transaction' : 'Quick Add Expense'}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#8A8A8A] hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-3 text-sm text-[#FF5A5F]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Transaction Type Selector */}
              <div>
                <label className={labelClass}>
                  Transaction Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['expense', 'lent', 'borrowed'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTransactionType(type)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        transactionType === type
                          ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                          : 'bg-[#111111] border-white/[0.08] text-[#8A8A8A] hover:text-white hover:border-white/[0.15]'
                      }`}
                    >
                      {type === 'expense' ? 'Expense' : type === 'lent' ? 'Lent' : 'Borrowed'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    {transactionType === 'borrowed' ? 'Title' : 'Title / Item'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Petrol, Groceries, Dinner"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Date & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {transactionType === 'borrowed' ? 'Used For' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* [Conditional Field] Petrol Vehicle Type */}
              {category === 'Petrol' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/[0.03] border border-white/[0.06] p-3.5 rounded-xl space-y-2"
                >
                  <label className="block text-xs font-normal uppercase tracking-wider text-gold-400">
                    Vehicle Type
                  </label>
                  <select
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Car">Car</option>
                    <option value="Jupiter 125">Jupiter 125</option>
                    <option value="Maestro Edge">Maestro Edge</option>
                  </select>
                </motion.div>
              )}

              {/* Person Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-normal uppercase tracking-wider text-[#8A8A8A]">
                      {transactionType === 'borrowed'
                        ? 'Taken From (Person)'
                        : transactionType === 'lent'
                        ? 'Lent To'
                        : 'Paid For / With Whom'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomPersonActive(!isCustomPersonActive)}
                      className="text-[10px] font-medium text-gold-400 hover:text-gold-400/80 transition-colors"
                    >
                      {isCustomPersonActive ? 'Choose Dropdown' : 'Add Custom'}
                    </button>
                  </div>

                  {isCustomPersonActive ? (
                    <input
                      type="text"
                      required
                      placeholder="Enter custom name"
                      value={customPerson}
                      onChange={(e) => setCustomPerson(e.target.value)}
                      className={inputClass}
                    />
                  ) : (
                    <select
                      required
                      value={personId}
                      onChange={(e) => setPersonId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="" disabled>Select Person</option>
                      {persons.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Source Account select */}
                <div>
                  <label className={labelClass}>
                    {transactionType === 'borrowed' ? 'Destination Account' : 'Source Account'}
                  </label>
                  <select
                    value={sourceAccount}
                    onChange={(e) => setSourceAccount(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Self Account">Self Account</option>
                    <option value="Salary Account">Salary Account</option>
                  </select>
                </div>
              </div>

              {/* Payment Method Selector (Hidden for Salary Account since it's hardcoded to UPI) */}
              {sourceAccount !== 'Salary Account' && (
                <div>
                  <label className={labelClass}>
                    {transactionType === 'borrowed' ? 'Received Via' : 'Payment Method'}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {visiblePaymentMethods.map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                          paymentMethod === method
                            ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                            : 'bg-[#111111] border-white/[0.08] text-[#8A8A8A] hover:text-white hover:border-white/[0.15]'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* [Conditional Fields] UPI Details (Hidden for Salary Account since it's hardcoded to GPay/Cred UPI) */}
              {paymentMethod === 'UPI' && sourceAccount !== 'Salary Account' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/[0.03] border border-white/[0.06] p-4 rounded-xl space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-normal uppercase tracking-wider text-gold-400 mb-1">
                        UPI App
                      </label>
                      <select
                        value={upiApp}
                        onChange={(e) => setUpiApp(e.target.value)}
                        className={inputClass}
                      >
                        <option value="GPay">GPay</option>
                        <option value="Amazon Pay">Amazon Pay</option>
                        <option value="Cred UPI">Cred UPI</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-normal uppercase tracking-wider text-gold-400 mb-1">
                        Linked Account
                      </label>
                      <select
                        value={upiLinkedAccount}
                        onChange={(e) => setUpiLinkedAccount(e.target.value)}
                        className={inputClass}
                      >
                        <option value="Yes Bank">Yes Bank</option>
                        <option value="ICICI Credit Card">ICICI Credit Card</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* [Conditional Fields] Credit Card Details */}
              {paymentMethod === 'Credit Card' && sourceAccount !== 'Salary Account' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white/[0.03] border border-white/[0.06] p-4 rounded-xl space-y-2"
                >
                  <label className="block text-xs font-normal uppercase tracking-wider text-gold-400">
                    Credit Card Issuer
                  </label>
                  <select
                    value={creditCardIssuer}
                    onChange={(e) => setCreditCardIssuer(e.target.value)}
                    className={inputClass}
                  >
                    <option value="ICICI">ICICI</option>
                    <option value="Yes Bank">Yes Bank</option>
                    <option value="OneCard">OneCard</option>
                  </select>
                </motion.div>
              )}

              {/* Notes */}
              <div>
                <label className={labelClass}>
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add details, description or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-white/[0.06]">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium bg-gold-400 text-black hover:bg-gold-500 transition-all disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {expenseToEdit ? 'Save Changes' : 'Create Expense'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-sm font-normal text-[#8A8A8A] hover:text-white transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
