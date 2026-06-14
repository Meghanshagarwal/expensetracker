'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Calendar, CheckCircle2, XCircle, 
  Loader2, ArrowUpRight, Search, Undo2, Filter, User, Plus
} from 'lucide-react';
import { getLocalExpenses, getLocalPersons, getLocalCards, saveLocalExpenses, saveLocalCards, addToSyncQueue } from '@/lib/offlineDb';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Expense, Person, Card } from '@/types';
import Navbar from '@/components/Navbar';

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

  // Add Card form inputs
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNetwork, setNewCardNetwork] = useState<'Rupay' | 'Visa' | 'Mastercard'>('Visa');
  const [newCardLast4, setNewCardLast4] = useState('');
  const [newCardColorTheme, setNewCardColorTheme] = useState('charcoal');
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

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
    return list.filter(exp => {
      const isCC = exp.paymentMethod === 'Credit Card';
      const isUPI = exp.paymentMethod === 'UPI';

      return (isCC && exp.creditCardIssuer === cardName) ||
             (isUPI && exp.upiLinkedAccount === `${cardName} Credit Card`);
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

  // Add custom card submission handler
  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim() || !newCardLast4.trim() || newCardLast4.length !== 4) return;

    setCardLoading(true);
    setCardError(null);

    const payload = {
      name: newCardName.trim(),
      cardNetwork: newCardNetwork,
      last4: newCardLast4.trim(),
      colorTheme: newCardColorTheme
    };

    try {
      if (!navigator.onLine) {
        const newCard = await addCardOffline(payload);
        setCards(prev => [...prev, newCard]);
        setSelectedCardId(newCard._id);
        setIsAddCardModalOpen(false);
        setNewCardName('');
        setNewCardLast4('');
      } else {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const newCard = await res.json();
          // Reload cards database cache
          const updatedCards = await getLocalCards();
          setCards(updatedCards);
          setSelectedCardId(newCard._id);
          setIsAddCardModalOpen(false);
          setNewCardName('');
          setNewCardLast4('');
        } else {
          const data = await res.json();
          setCardError(data.error || 'Failed to add card');
        }
      }
    } catch (err) {
      console.error(err);
      setCardError('Error connecting to server');
    } finally {
      setCardLoading(false);
    }
  };

  // Carousel Swipe Actions
  const handleNextCard = () => {
    if (cards.length <= 1) return;
    const currentIndex = cards.findIndex(c => c._id === selectedCardId);
    const nextIndex = (currentIndex + 1) % cards.length;
    setSelectedCardId(cards[nextIndex]._id);
    setExpandedTxId(null);
  };

  const handlePrevCard = () => {
    if (cards.length <= 1) return;
    const currentIndex = cards.findIndex(c => c._id === selectedCardId);
    const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
    setSelectedCardId(cards[prevIndex]._id);
    setExpandedTxId(null);
  };

  // Stack/Fan layout metrics based on currently selected card
  const getCardStyle = (cardIndex: number, totalCards: number) => {
    const activeIndex = cards.findIndex(c => c._id === selectedCardId);
    if (activeIndex === -1) return {};

    // Calculate relative index diff
    let diff = cardIndex - activeIndex;
    if (diff > 1) diff -= totalCards;
    if (diff < -1) diff += totalCards;

    // Handle standard mobile width responsive scaling
    const xOffset = isMobile ? 40 : 120; // Fit perfectly on mobile screen width without overflow
    const yOffset = isMobile ? 8 : 12;
    const rotation = isMobile ? 5 : 8;

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
      // Card fanned to the right
      return {
        x: xOffset,
        y: yOffset,
        scale: 0.85,
        rotate: rotation,
        zIndex: 20,
        filter: 'brightness(0.55)',
        pointerEvents: 'auto' as const
      };
    } else {
      // Card fanned to the left
      return {
        x: -xOffset,
        y: yOffset,
        scale: 0.85,
        rotate: -rotation,
        zIndex: 10,
        filter: 'brightness(0.55)',
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
    <div className="min-h-screen bg-black text-white selection:bg-gold-400 selection:text-black">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-32 md:pb-12 overflow-x-hidden">
        {/* Header Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex justify-between items-start w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-gold-400" />
                Cards Ledger
              </h1>
              <p className="text-xs text-[#8A8A8A] mt-1">
                Track outstanding balances and mark credit card statements as paid.
              </p>
            </div>
            
            <button
              onClick={() => {
                setIsAddCardModalOpen(true);
                setCardError(null);
              }}
              className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Card
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 md:p-5 w-full md:min-w-[280px] shadow-luxury">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium block mb-1">
                Total Outstanding Balance
              </span>
              <span className="text-3xl font-extrabold text-gold-400 tracking-tight">
                {formatRupee(totalOutstandingAllCards)}
              </span>
            </div>

            <button
              onClick={() => {
                setIsAddCardModalOpen(true);
                setCardError(null);
              }}
              className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Card
            </button>
          </div>
        </div>

        {/* Overlapping CRED Card Carousel Stack */}
        <div className="relative h-[210px] md:h-[240px] w-full max-w-[480px] mx-auto flex items-center justify-center mb-8 overflow-visible mt-2">
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
                  style={{ touchAction: 'pan-y' }}
                  animate={getCardStyle(idx, cards.length)}
                  transition={{ type: 'spring', stiffness: 280, damping: 25 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(event, info) => {
                    const threshold = 50;
                    if (info.offset.x < -threshold) {
                      handleNextCard();
                    } else if (info.offset.x > threshold) {
                      handlePrevCard();
                    }
                  }}
                  onClick={() => {
                    setSelectedCardId(card._id);
                    setExpandedTxId(null);
                  }}
                  className={`absolute cursor-pointer rounded-2xl p-4 md:p-6 w-[245px] md:w-[325px] h-[160px] md:h-[200px] flex flex-col justify-between select-none shadow-2xl transition-shadow ${gradient} ${
                    isActive ? 'border-2 border-gold-400 shadow-[0_0_30px_rgba(212,175,55,0.18)]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-semibold tracking-widest uppercase ${textAccent}`}>
                        {card.name}
                      </span>
                      <span className="block text-[8px] text-white/50 uppercase tracking-wide mt-0.5">
                        {card.cardNetwork} Edition
                      </span>
                    </div>
                    
                    <div className="w-9 h-6 bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded border border-amber-800/10 shadow-inner flex items-center justify-center overflow-hidden opacity-40">
                      <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5">
                        <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                        <div className="border border-black/20" /><div className="border border-black/20" /><div className="border border-black/20" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#8A8A8A] uppercase tracking-wider block">
                      Outstanding Balance
                    </span>
                    <span className="text-xl md:text-2xl font-bold tracking-tight text-white mt-0.5 block">
                      {formatRupee(cardMetrics[card.name]?.outstanding || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-end text-[9px] text-[#555555]">
                    <span>{cardNum}</span>
                    <span className="text-[#8A8A8A]">Total: {formatRupee(cardMetrics[card.name]?.spent || 0)}</span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Transactions Panel Section */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-6 shadow-luxury mt-8">
          {/* Title & Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.06] mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold-400 animate-pulse" />
              {selectedCardName} Transactions ({filteredTransactions.length})
            </h2>

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
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-semibold text-white text-base">
                            {tx.title}
                          </h3>
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
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                              UPI ({tx.upiLinkedAccount})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#8A8A8A]">
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

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <span className={`text-lg font-bold ${tx.isCardPaid ? 'text-[#8A8A8A] line-through' : 'text-white'}`}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </span>

                        <div className="flex items-center gap-2">
                          {tx.isCardPaid ? (
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-green-400 bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                PAID ({tx.cardPaidFrom})
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsUnpaid(tx);
                                }}
                                className="p-1.5 rounded-lg bg-[#222222] border border-white/[0.05] text-[#8A8A8A] hover:text-white hover:bg-[#333333] transition-all"
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
      </main>

      {/* Add Card Modal */}
      <AnimatePresence>
        {isAddCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCardModalOpen(false)}
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
                Add Custom Card
              </h3>

              {cardError && (
                <div className="mb-4 rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2.5 text-xs text-[#FF5A5F]">
                  {cardError}
                </div>
              )}

              <form onSubmit={handleAddCardSubmit} className="space-y-4">
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

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCardModalOpen(false)}
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
                    Add Card
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
