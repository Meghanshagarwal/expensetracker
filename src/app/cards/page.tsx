'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Calendar, CheckCircle2, XCircle,
  Loader2, ArrowUpRight, Search, Undo2, Filter, User, Plus, Pencil,
  Bell, BellRing, BellOff, AlertCircle
} from 'lucide-react';
import { getLocalExpenses, getLocalPersons, getLocalCards, saveLocalExpenses, saveLocalCards, addToSyncQueue } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { isPushSupported, getPushSubscribed, enablePush, disablePush } from '@/lib/push';
import { Expense, Person, Card } from '@/types';

type CardType = 'ICICI' | 'OneCard' | 'Yes Bank';

export default function CardsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mark as Paid form inputs
  const [paidFrom, setPaidFrom] = useState<string>('Salary Account');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Add / Edit Card form inputs
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNetwork, setNewCardNetwork] = useState<'Rupay' | 'Visa' | 'Mastercard'>('Visa');
  const [newCardLast4, setNewCardLast4] = useState('');
  const [newCardColorTheme, setNewCardColorTheme] = useState('charcoal');
  const [newStatementDate, setNewStatementDate] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Push reminder state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const { isOnline, fetchAndCacheData, addCardOffline } = useOfflineSync();

  const loadData = useCallback(async () => {
    const localExp = await getLocalExpenses();
    const localPer = await getLocalPersons();
    const localCards = await getLocalCards();
    setExpenses(localExp);
    setPersons(localPer);
    setCards(localCards);

    if (navigator.onLine) {
      try {
        await fetchAndCacheData();
        const updatedExp = await getLocalExpenses();
        const updatedPer = await getLocalPersons();
        const updatedCards = await getLocalCards();
        setExpenses(updatedExp);
        setPersons(updatedPer);
        setCards(updatedCards);
      } catch (err) {
        console.error('Failed to sync and load card expenses:', err);
      }
    }
  }, [fetchAndCacheData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default selected card once cards load
  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0]._id);
    }
  }, [cards, selectedCardId]);

  const getPersonName = useCallback((personId: string) => {
    const p = persons.find(per => per._id === personId);
    return p ? p.name : 'Self';
  }, [persons]);

  const isPersonSelf = useCallback((name: string) => {
    const lowerName = name.toLowerCase();
    return lowerName === 'self' || lowerName === 'my self' || lowerName === 'myself';
  }, []);

  // Reset inputs when selected transaction expands
  useEffect(() => {
    if (expandedTxId) {
      setPaidFrom('Salary Account');
      setPaidDate(new Date().toISOString().split('T')[0]);
      setSettlementNotes('');
    }
  }, [expandedTxId]);

  // Currently selected card object
  const selectedCardObj = useMemo(() => {
    return cards.find(c => c._id === selectedCardId) || cards[0];
  }, [cards, selectedCardId]);

  const selectedCardName = useMemo(() => {
    return selectedCardObj?.name || 'OneCard';
  }, [selectedCardObj]);

  // Card Transaction Matching Logic
  const getCardExpenses = useCallback((cardName: string, list: Expense[]) => {
    const targetName = cardName.toLowerCase();
    return list.filter(exp => {
      const isCC = exp.paymentMethod === 'Credit Card';
      const isUPI = exp.paymentMethod === 'UPI';

      return (isCC && exp.creditCardIssuer?.toLowerCase() === targetName) ||
             (isUPI && (exp.upiLinkedAccount?.toLowerCase() === `${targetName} credit card` || exp.upiLinkedAccount?.toLowerCase() === targetName));
    });
  }, []);

  // Compute Metrics for each card
  const cardMetrics = useMemo(() => {
    const metrics: Record<string, { spent: number; outstanding: number; paid: number }> = {};

    cards.forEach(card => {
      metrics[card.name] = { spent: 0, outstanding: 0, paid: 0 };
      const txs = getCardExpenses(card.name, expenses);
      txs.forEach(t => {
        metrics[card.name].spent += t.amount;
        if (t.isCardPaid) {
          metrics[card.name].paid += t.amount;
        } else {
          metrics[card.name].outstanding += t.amount;
        }
      });
    });

    return metrics;
  }, [expenses, cards, getCardExpenses]);

  // Total Outstanding across all cards
  const totalOutstandingAllCards = useMemo(() => {
    return Object.values(cardMetrics).reduce((sum, c) => sum + c.outstanding, 0);
  }, [cardMetrics]);

  // Filtered transactions for the currently selected card
  const filteredTransactions = useMemo(() => {
    const cardTxs = getCardExpenses(selectedCardName, expenses);
    
    return cardTxs.filter(tx => {
      // Apply status filter
      if (filterStatus === 'paid' && !tx.isCardPaid) return false;
      if (filterStatus === 'unpaid' && tx.isCardPaid) return false;

      // Apply search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const titleMatch = tx.title.toLowerCase().includes(query);
        const categoryMatch = tx.category.toLowerCase().includes(query);
        const notesMatch = tx.notes?.toLowerCase().includes(query) || false;
        return titleMatch || categoryMatch || notesMatch;
      }

      return true;
    });
  }, [selectedCardName, expenses, filterStatus, searchQuery, getCardExpenses]);

  // Mark as Paid handler
  const handleMarkAsPaid = async (expense: Expense) => {
    if (submitLoading) return;
    setSubmitLoading(true);

    const isPersonRepayment = paidFrom.includes('(Cash)') || paidFrom.includes('(UPI)');
    let updatedRepayments = expense.repayments ? [...expense.repayments] : [];

    if (isPersonRepayment) {
      const paymentMethod = paidFrom.includes('(Cash)') ? 'Cash' : 'UPI';
      updatedRepayments.push({
        amount: expense.amount,
        paymentMethod: paymentMethod,
        date: new Date(paidDate).toISOString(),
        notes: settlementNotes.trim() || `Settled credit card statement charge for "${expense.title}"`
      });
    }

    const updatedExpense: Expense = {
      ...expense,
      isCardPaid: true,
      cardPaidDate: new Date(paidDate).toISOString(),
      cardPaidFrom: paidFrom,
      repayments: updatedRepayments
    };

    try {
      if (!navigator.onLine) {
        // Offline Flow
        const current = await getLocalExpenses();
        const updated = current.map(e => e._id === expense._id ? updatedExpense : e);
        await saveLocalExpenses(updated);
        await addToSyncQueue('expense', 'update', updatedExpense);
        setExpenses(updated);
        setExpandedTxId(null);
      } else {
        // Online Flow
        const res = await fetch('/api/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: expense._id,
            isCardPaid: true,
            cardPaidDate: new Date(paidDate).toISOString(),
            cardPaidFrom: paidFrom,
            repayments: updatedRepayments
          })
        });

        if (res.ok) {
          await loadData();
          setExpandedTxId(null);
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to update transaction status');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error updating transaction status');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Revert / Mark as Unpaid handler
  const handleMarkAsUnpaid = async (expense: Expense) => {
    if (!window.confirm('Are you sure you want to mark this transaction as UNPAID?')) return;

    let updatedRepayments = expense.repayments ? [...expense.repayments] : [];
    if (expense.cardPaidFrom && (expense.cardPaidFrom.includes('(Cash)') || expense.cardPaidFrom.includes('(UPI)'))) {
      const repaymentIndex = updatedRepayments.findIndex(r => r.amount === expense.amount);
      if (repaymentIndex !== -1) {
        updatedRepayments.splice(repaymentIndex, 1);
      }
    }

    const updatedExpense: Expense = {
      ...expense,
      isCardPaid: false,
      cardPaidDate: undefined,
      cardPaidFrom: undefined,
      repayments: updatedRepayments
    };

    try {
      if (!navigator.onLine) {
        // Offline Flow
        const current = await getLocalExpenses();
        const updated = current.map(e => e._id === expense._id ? updatedExpense : e);
        await saveLocalExpenses(updated);
        await addToSyncQueue('expense', 'update', updatedExpense);
        setExpenses(updated);
      } else {
        // Online Flow
        const res = await fetch('/api/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: expense._id,
            isCardPaid: false,
            cardPaidDate: null,
            cardPaidFrom: null,
            repayments: updatedRepayments
          })
        });

        if (res.ok) {
          await loadData();
        } else {
          alert('Failed to update transaction status');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error updating transaction status');
    }
  };

  // Format a day-of-month as an ordinal, e.g. 1 -> "1st", 22 -> "22nd"
  const ordinalDay = (day?: number) => {
    if (!day) return null;
    const s = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  // Whole days from today until the next occurrence of a day-of-month
  const daysUntilDue = (dueDay?: number): number | null => {
    if (!dueDay) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const clamp = (y: number, m: number) => Math.min(dueDay, new Date(y, m + 1, 0).getDate());
    let y = today.getFullYear();
    let m = today.getMonth();
    let due = new Date(y, m, clamp(y, m));
    if (due < today) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      due = new Date(y, m, clamp(y, m));
    }
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  };

  // Init push subscription status
  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      getPushSubscribed().then(setPushOn);
    }
  }, []);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
        } else if (res.reason === 'denied') {
          alert('Notifications blocked. Please allow notifications for this site in your browser settings.');
        } else if (res.reason === 'not-configured') {
          alert('Reminders are not configured on the server yet (VAPID keys missing).');
        } else if (res.reason === 'unsupported') {
          alert('Your browser does not support push notifications. On iPhone, install the app to your Home Screen first.');
        } else {
          alert('Could not enable reminders. Please try again.');
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Cards whose payment is due within 3 days and still has an outstanding balance
  const dueSoonCards = useMemo(() => {
    return cards
      .map(c => ({
        name: c.name,
        days: daysUntilDue(c.dueDate),
        outstanding: cardMetrics[c.name]?.outstanding || 0,
      }))
      .filter(c => c.days !== null && c.days <= 3 && c.outstanding > 0)
      .sort((a, b) => (a.days as number) - (b.days as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, cardMetrics]);

  const resetCardForm = () => {
    setNewCardName('');
    setNewCardNetwork('Visa');
    setNewCardLast4('');
    setNewCardColorTheme('charcoal');
    setNewStatementDate('');
    setNewDueDate('');
    setCardError(null);
  };

  const openAddCard = () => {
    setEditingCardId(null);
    resetCardForm();
    setIsAddCardModalOpen(true);
  };

  const openEditCard = (card: Card) => {
    setEditingCardId(card._id);
    setNewCardName(card.name);
    setNewCardNetwork((card.cardNetwork as 'Rupay' | 'Visa' | 'Mastercard') || 'Visa');
    setNewCardLast4(card.last4 || '');
    setNewCardColorTheme(card.colorTheme || 'charcoal');
    setNewStatementDate(card.statementDate ? String(card.statementDate) : '');
    setNewDueDate(card.dueDate ? String(card.dueDate) : '');
    setCardError(null);
    setIsAddCardModalOpen(true);
  };

  const closeCardModal = () => {
    setIsAddCardModalOpen(false);
    setEditingCardId(null);
  };

  // Add / Edit card submission handler
  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim() || !newCardLast4.trim() || newCardLast4.length !== 4) return;

    setCardLoading(true);
    setCardError(null);

    const payload = {
      name: newCardName.trim(),
      cardNetwork: newCardNetwork,
      last4: newCardLast4.trim(),
      colorTheme: newCardColorTheme,
      statementDate: newStatementDate ? Number(newStatementDate) : undefined,
      dueDate: newDueDate ? Number(newDueDate) : undefined,
    };

    try {
      if (editingCardId) {
        // ----- EDIT existing card -----
        if (!navigator.onLine) {
          const existing = cards.find(c => c._id === editingCardId);
          const updatedCard = { ...existing, ...payload, _id: editingCardId } as Card;
          const updatedList = cards.map(c => (c._id === editingCardId ? updatedCard : c));
          await saveLocalCards(updatedList);
          await addToSyncQueue('card', 'update', updatedCard);
          setCards(updatedList);
          closeCardModal();
        } else {
          const res = await fetch('/api/cards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingCardId, ...payload }),
          });
          if (res.ok) {
            await fetchAndCacheData();
            setCards(await getLocalCards());
            closeCardModal();
          } else {
            const data = await res.json();
            setCardError(data.error || 'Failed to update card');
          }
        }
      } else {
        // ----- ADD new card -----
        if (!navigator.onLine) {
          const newCard = await addCardOffline(payload);
          setCards(prev => [...prev, newCard]);
          setSelectedCardId(newCard._id);
          closeCardModal();
        } else {
          const res = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const newCard = await res.json();
            await fetchAndCacheData();
            setCards(await getLocalCards());
            setSelectedCardId(newCard._id);
            closeCardModal();
          } else {
            const data = await res.json();
            setCardError(data.error || 'Failed to add card');
          }
        }
      }
    } catch (err) {
      console.error(err);
      setCardError('Error connecting to server');
    } finally {
      setCardLoading(false);
    }
  };

  // ---- Samsung Wallet–style swipe sound (synthesized, no asset) ----
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSwipeSound = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Soft rising "swoosh" blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);

      // Subtle high "tick" for a tactile click
      const tick = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(1500, now);
      tickGain.gain.setValueAtTime(0.0001, now);
      tickGain.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      tick.connect(tickGain).connect(ctx.destination);
      tick.start(now);
      tick.stop(now + 0.06);
    } catch {
      /* ignore audio errors */
    }
  };

  // Carousel Swipe Actions
  const handleNextCard = () => {
    if (cards.length <= 1) return;
    const currentIndex = cards.findIndex(c => c._id === selectedCardId);
    const nextIndex = (currentIndex + 1) % cards.length;
    setSelectedCardId(cards[nextIndex]._id);
    setExpandedTxId(null);
    playSwipeSound();
  };

  const handlePrevCard = () => {
    if (cards.length <= 1) return;
    const currentIndex = cards.findIndex(c => c._id === selectedCardId);
    const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
    setSelectedCardId(cards[prevIndex]._id);
    setExpandedTxId(null);
    playSwipeSound();
  };

  // Vertical wallet stack layout — active card in front, prev peeks above, next peeks below
  const getCardStyle = (cardIndex: number, totalCards: number) => {
    const activeIndex = cards.findIndex(c => c._id === selectedCardId);
    if (activeIndex === -1) return {};

    // Calculate relative index diff
    let diff = cardIndex - activeIndex;
    if (diff > 1) diff -= totalCards;
    if (diff < -1) diff += totalCards;

    const yOffset = isMobile ? 50 : 62; // vertical peek distance

    if (diff === 0) {
      // Active card in front
      return {
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        zIndex: 30,
        filter: 'brightness(1)',
        pointerEvents: 'auto' as const
      };
    } else if (diff === 1 || (diff < -1 && totalCards === 2)) {
      // Next card peeks below
      return {
        x: 0,
        y: yOffset,
        scale: 0.9,
        rotate: 0,
        zIndex: 20,
        filter: 'brightness(0.5)',
        pointerEvents: 'auto' as const
      };
    } else {
      // Previous card peeks above
      return {
        x: 0,
        y: -yOffset,
        scale: 0.9,
        rotate: 0,
        zIndex: 10,
        filter: 'brightness(0.5)',
        pointerEvents: 'auto' as const
      };
    }
  };

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
    <>
      <div className="overflow-x-hidden">
        {/* Due-soon reminder banner */}
        {dueSoonCards.length > 0 && (
          <div className="mb-5 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] p-3.5 sm:p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-gold-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gold-400">Payment{dueSoonCards.length > 1 ? 's' : ''} due soon</p>
              <p className="text-xs text-[#C9C9C9] mt-0.5 leading-relaxed">
                {dueSoonCards.map((c, i) => (
                  <span key={c.name}>
                    {i > 0 && '  •  '}
                    <span className="text-white font-medium">{c.name}</span>{' '}
                    <span className="font-mono">{formatRupee(c.outstanding)}</span>{' '}
                    {c.days === 0 ? 'due today' : c.days === 1 ? 'due tomorrow' : `due in ${c.days} days`}
                  </span>
                ))}
              </p>
            </div>
            {pushSupported && !pushOn && (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                className="shrink-0 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all disabled:opacity-50"
              >
                {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                Remind me
              </button>
            )}
          </div>
        )}

        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex justify-between items-start gap-3 w-full md:w-auto">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2 sm:gap-3">
                <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-gold-400 shrink-0" />
                Cards Ledger
              </h1>
              <p className="text-xs text-[#8A8A8A] mt-1">
                Track outstanding balances and mark credit card statements as paid.
              </p>
            </div>

            <div className="md:hidden shrink-0 flex items-center gap-2 mt-1">
              {pushSupported && (
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  title={pushOn ? 'Reminders on' : 'Enable due-date reminders'}
                  className={`flex items-center justify-center h-8 w-8 rounded-xl border transition-all disabled:opacity-50 ${
                    pushOn
                      ? 'bg-gold-400/15 border-gold-400/40 text-gold-400'
                      : 'bg-white/[0.04] border-white/[0.08] text-[#8A8A8A]'
                  }`}
                >
                  {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : pushOn ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={openAddCard}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Card
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 md:p-5 w-full md:min-w-[280px] shadow-luxury">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium block mb-1">
                Total Outstanding Balance
              </span>
              <span className="text-3xl font-extrabold font-mono tabular-nums text-gold-400 tracking-tight">
                {formatRupee(totalOutstandingAllCards)}
              </span>
            </div>

            {pushSupported && (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                title={pushOn ? 'Due-date reminders on' : 'Enable due-date reminders'}
                className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
                  pushOn
                    ? 'bg-gold-400/15 border-gold-400/40 text-gold-400'
                    : 'bg-white/[0.04] border-white/[0.08] text-[#8A8A8A] hover:text-white'
                }`}
              >
                {pushBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : pushOn ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {pushOn ? 'Reminders on' : 'Reminders'}
              </button>
            )}

            <button
              onClick={openAddCard}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Card
            </button>
          </div>
        </div>

        {/* Vertical wallet card stack (swipe up/down) */}
        <div className="relative h-[290px] md:h-[330px] w-full max-w-[480px] mx-auto flex items-center justify-center mb-6 overflow-visible">
          {cards.length === 0 ? (
            <div className="text-[#555555] text-xs py-8">Loading credit cards...</div>
          ) : (
            cards.map((card, idx) => {
              const isActive = selectedCardId === card._id;
              
              // Define dynamic gradient themes based on colorTheme or name
              let gradient = 'bg-gradient-to-br from-[#121212] via-[#222222] to-[#0A0A0A] border border-white/[0.08]'; // Default OneCard
              let textAccent = 'text-gold-400';
              let chipTheme = 'from-yellow-300 via-yellow-500 to-amber-600';
              let cardNum = `•••• •••• •••• ${card.last4}`;

              if (card.colorTheme === 'coral' || card.name.toLowerCase() === 'icici') {
                gradient = 'bg-gradient-to-br from-[#E75B3F] via-[#C93E23] to-[#7A1200] border border-orange-500/10';
                textAccent = 'text-white';
                chipTheme = 'from-slate-200 to-slate-400';
              } else if (card.colorTheme === 'cobalt' || card.name.toLowerCase() === 'yes bank') {
                gradient = 'bg-gradient-to-br from-[#003C8F] via-[#002171] to-[#000A21] border border-blue-500/10';
                textAccent = 'text-[#90CAF9]';
                chipTheme = 'from-yellow-200 via-yellow-400 to-amber-600';
              } else if (card.colorTheme === 'emerald') {
                gradient = 'bg-gradient-to-br from-[#004D40] via-[#00701a] to-[#00251a] border border-emerald-500/15';
                textAccent = 'text-emerald-300';
                chipTheme = 'from-yellow-200 via-yellow-400 to-amber-500';
              }

              return (
                <motion.div
                  key={card._id}
                  style={{ touchAction: 'pan-x' }}
                  animate={getCardStyle(idx, cards.length)}
                  transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.5}
                  whileDrag={{ scale: isActive ? 1.03 : 0.88, cursor: 'grabbing' }}
                  whileTap={{ scale: isActive ? 0.98 : 0.84 }}
                  onDragEnd={(event, info) => {
                    const threshold = 45;
                    const velocity = info.velocity.y;
                    // Swipe up → next card, swipe down → previous card
                    if (info.offset.y < -threshold || velocity < -350) {
                      handleNextCard();
                    } else if (info.offset.y > threshold || velocity > 350) {
                      handlePrevCard();
                    }
                  }}
                  onClick={() => {
                    setSelectedCardId(card._id);
                    setExpandedTxId(null);
                  }}
                  className={`absolute cursor-pointer rounded-2xl p-5 md:p-6 w-[280px] md:w-[325px] h-[175px] md:h-[200px] flex flex-col justify-between select-none shadow-2xl transition-shadow overflow-hidden ${gradient} ${
                    isActive ? 'ring-2 ring-gold-400 ring-offset-0 shadow-[0_0_36px_rgba(212,175,55,0.22)]' : ''
                  }`}
                >
                  {/* CRED-style glossy light sweep on the active card */}
                  {isActive && (
                    <div className="card-sheen pointer-events-none absolute inset-0 z-20">
                      <span className="card-sheen-beam" />
                    </div>
                  )}

                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-semibold tracking-widest uppercase ${textAccent}`}>
                        {card.name}
                      </span>
                      <span className="block text-[8px] text-white/50 uppercase tracking-wide mt-0.5">
                        {card.cardNetwork} Edition
                      </span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="w-9 h-6 bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded border border-amber-800/10 shadow-inner flex items-center justify-center overflow-hidden opacity-40">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5">
                          <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                          <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                        </div>
                      </div>
                      {card.dueDate && (
                        <span className="text-[8px] font-mono font-semibold uppercase tracking-wider text-white/80 bg-black/30 border border-white/10 px-1.5 py-0.5 rounded">
                          Due {ordinalDay(card.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#8A8A8A] uppercase tracking-wider block">
                      Outstanding Balance
                    </span>
                    <span className="text-xl md:text-2xl font-bold font-mono tabular-nums tracking-tight text-white mt-0.5 block">
                      {formatRupee(cardMetrics[card.name]?.outstanding || 0)}
                    </span>
                  </div>

                  <div className="relative z-10 flex justify-between items-end text-[9px] text-[#555555] font-mono tabular-nums tracking-wider">
                    <span>{cardNum}</span>
                    <span className="text-[#8A8A8A]">Total: {formatRupee(cardMetrics[card.name]?.spent || 0)}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Transactions Panel Section */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 sm:p-6 shadow-luxury mt-8">
          {/* Title & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.06] mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-gold-400 animate-pulse shrink-0" />
                  <span className="truncate">{selectedCardName} Transactions ({filteredTransactions.length})</span>
                </h2>
                {selectedCardObj && (
                  <button
                    onClick={() => openEditCard(selectedCardObj)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-[#8A8A8A] hover:text-gold-400 hover:border-gold-400/30 transition-all"
                    title="Edit card details"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {(selectedCardObj?.statementDate || selectedCardObj?.dueDate) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8A8A8A] font-mono">
                  {selectedCardObj?.statementDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#555555]" />
                      Statement: <span className="text-white/80">{ordinalDay(selectedCardObj.statementDate)}</span>
                    </span>
                  )}
                  {selectedCardObj?.dueDate && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-gold-400/70" />
                      Due: <span className="text-gold-400">{ordinalDay(selectedCardObj.dueDate)}</span> of every month
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Search item, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black border border-white/[0.08] pl-10 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/10 focus:outline-none transition-all w-full sm:w-[220px]"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-black p-1 rounded-xl border border-white/[0.08]">
                {(['unpaid', 'paid', 'all'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterStatus(status);
                      setExpandedTxId(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                      filterStatus === status
                        ? 'bg-gold-400/10 border border-gold-400/20 text-gold-400'
                        : 'text-[#8A8A8A] hover:text-white border border-transparent'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-[#555555] text-sm">
                No credit card transactions found matching criteria.
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const isExpanded = expandedTxId === tx._id;
                const personName = getPersonName(tx.personId);
                const isSelf = isPersonSelf(personName);

                return (
                  <div
                    key={tx._id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded 
                        ? 'bg-black/50 border-gold-400/30 shadow-md' 
                        : tx.isCardPaid 
                          ? 'bg-transparent border-white/[0.03] hover:bg-white/[0.01]' 
                          : 'bg-[#151515] border-white/[0.06] hover:bg-[#1C1C1C]'
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => !tx.isCardPaid && setExpandedTxId(isExpanded ? null : tx._id)}
                      className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                        !tx.isCardPaid ? 'cursor-pointer select-none' : ''
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-base truncate">
                          {tx.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/[0.04] text-[#8A8A8A]">
                            {tx.category}
                          </span>
                          {!isSelf && (
                            <span className="text-[10px] text-gold-400 bg-gold-400/10 border border-gold-400/20 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                              <User className="h-3 w-3" />
                              {personName}
                            </span>
                          )}
                          {tx.paymentMethod === 'UPI' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 max-w-full truncate">
                              UPI ({tx.upiLinkedAccount})
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8A8A8A]">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(tx.date)}
                          </span>
                          {tx.notes && (
                            <span className="italic truncate max-w-[200px] sm:max-w-xs text-[#555555]">
                              "{tx.notes}"
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end min-w-0">
                        <span className={`text-lg font-bold font-mono tabular-nums shrink-0 ${tx.isCardPaid ? 'text-[#8A8A8A] line-through' : 'text-white'}`}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </span>

                        <div className="flex items-center gap-2 min-w-0">
                          {tx.isCardPaid ? (
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <span className="text-[10px] text-green-400 bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold min-w-0 max-w-[150px] sm:max-w-none">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">PAID ({tx.cardPaidFrom})</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsUnpaid(tx);
                                }}
                                className="shrink-0 p-1.5 rounded-lg bg-[#222222] border border-white/[0.05] text-[#8A8A8A] hover:text-white hover:bg-[#333333] transition-all"
                                title="Mark as Unpaid"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTxId(isExpanded ? null : tx._id);
                              }}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all flex items-center gap-1"
                            >
                              Mark Paid
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline Expandable Settlement Form */}
                    <AnimatePresence>
                      {isExpanded && !tx.isCardPaid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-white/[0.06] bg-[#0A0A0A] p-4"
                        >
                          <div className="max-w-xl space-y-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                              Statement Settlement Details
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                                  Paid From (Account)
                                </label>
                                <select
                                  value={paidFrom}
                                  onChange={(e) => setPaidFrom(e.target.value)}
                                  className="w-full rounded-xl bg-[#111111] border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                                >
                                  <option value="Salary Account">Salary Account</option>
                                  <option value="Self Account">Self Account</option>
                                  {!isSelf && (
                                    <>
                                      <option value={`${personName} (Cash)`}>{personName} (Cash)</option>
                                      <option value={`${personName} (UPI)`}>{personName} (UPI)</option>
                                    </>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                                  Payment Date
                                </label>
                                <input
                                  type="date"
                                  value={paidDate}
                                  onChange={(e) => setPaidDate(e.target.value)}
                                  className="w-full rounded-xl bg-[#111111] border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-xs text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                                  Settlement Note (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Add details, e.g. Paid card bill from salary account"
                                  value={settlementNotes}
                                  onChange={(e) => setSettlementNotes(e.target.value)}
                                  className="w-full rounded-xl bg-[#111111] border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => setExpandedTxId(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-[#8A8A8A] hover:text-white hover:bg-white/[0.02]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={submitLoading}
                                onClick={() => handleMarkAsPaid(tx)}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {submitLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                Confirm Settlement
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      <AnimatePresence>
        {isAddCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCardModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-2xl bg-[#111111] border border-white/[0.06] p-6 text-white shadow-luxury z-10"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-gold-400" />
                {editingCardId ? 'Edit Card Details' : 'Add Custom Card'}
              </h3>

              {cardError && (
                <div className="mb-4 rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2.5 text-xs text-[#FF5A5F]">
                  {cardError}
                </div>
              )}

              <form onSubmit={handleCardSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                    Card Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBI, HDFC, Axis"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Card Network
                    </label>
                    <select
                      value={newCardNetwork}
                      onChange={(e) => setNewCardNetwork(e.target.value as any)}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Rupay">Rupay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Last 4 digits
                    </label>
                    <input
                      type="text"
                      required
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="e.g. 5678"
                      value={newCardLast4}
                      onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                    Card Color Theme
                  </label>
                  <select
                    value={newCardColorTheme}
                    onChange={(e) => setNewCardColorTheme(e.target.value)}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                  >
                    <option value="charcoal">Charcoal Black (Default)</option>
                    <option value="coral">Coral Ruby (ICICI)</option>
                    <option value="cobalt">Cobalt Indigo (Yes Bank)</option>
                    <option value="emerald">Emerald Jade (Rupay)</option>
                  </select>
                </div>

                {/* Billing cycle — statement & due day of month */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Statement Date
                    </label>
                    <select
                      value={newStatementDate}
                      onChange={(e) => setNewStatementDate(e.target.value)}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{ordinalDay(d)} of month</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Due Date
                    </label>
                    <select
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{ordinalDay(d)} of month</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeCardModal}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#8A8A8A] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={cardLoading}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {cardLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    {editingCardId ? 'Save Changes' : 'Add Card'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
