'use client';

import style from '@/components/LedgerSurfaces.module.css';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Plus, Pencil, Trash2, Loader2, Calendar, User,
  X, CheckCircle2, Clock, XCircle, Wallet, ArrowDownLeft
} from 'lucide-react';
import type { Ipo } from '@/types';
import { findIpoSchedule, indiaDate, ipoDate, type IpoSchedule } from '@/lib/ipoDates';
import { ipoDemo } from './demo';

// Open and upcoming IPOs from the live list, or a sample issue in demo mode.
type PresetIpo = IpoSchedule & {
  amount: number;
  priceBand?: string;
  openDate?: string;
  closeDate?: string;
  board?: string;
  source?: string;
  gmp?: number;
  gmpDirection?: 'up' | 'down';
};

const APPLIED_FROM = ['Me', 'Mummy', 'Papa', 'Anshshikha'];
const TAKEN_FROM_OPTIONS = [
  { value: 'Mummy', label: 'Mummy' },
  { value: 'Papa', label: 'Papa' },
  { value: 'My Salaried Account', label: 'My Salary Account' },
  { value: 'Me', label: 'My Self' },
  { value: 'Anshshikha', label: 'Anshu' },
];
const STATUSES = ['Applied', 'Allotted', 'Not Allotted'] as const;

// 'My Salaried Account' funding and 'Me' as the applicant both mean "self" —
// used to decide whether a refund needs to be tracked at all.
const normalizePerson = (name: string) =>
  name === 'My Salaried Account' ? 'me' : name.trim().toLowerCase();

const todayStr = indiaDate;

type FundingRow = { from: string; amount: string | number | null; date: string; returnDate: string };

function emptyFundingRow(): FundingRow {
  return { from: '', amount: null, date: todayStr(), returnDate: '' };
}

function canSetResult(allotmentDate?: string, closeDate?: string) {
  const today = todayStr();
  if (allotmentDate) return today >= allotmentDate;
  const close = ipoDate(closeDate);
  return !close || today > close;
}

const emptyForm = () => ({
  ipoName: '',
  presetKey: '',
  lots: 1,
  perLotAmount: 0, // base 1-lot amount; amount = lots × perLotAmount
  amount: '' as string | number,
  appliedFrom: 'Me',
  status: 'Applied' as (typeof STATUSES)[number],
  applyDate: todayStr(),
  openDate: '',
  closeDate: '',
  allotmentDate: '',
  contributions: [emptyFundingRow()],
  returnAmount: '' as string | number,
  returnDate: '',
  listingDate: '',
  profitAmount: '' as string | number,
  notes: '',
});

export default function IpoPage() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [presetIpos, setPresetIpos] = useState<PresetIpo[]>([]);
  const [schedules, setSchedules] = useState<IpoSchedule[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [presetSource, setPresetSource] = useState<'live' | 'empty' | 'unavailable' | 'loading'>('loading');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resultOnly, setResultOnly] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Applied' | 'Allotted' | 'Not Allotted'>('all');
  const fundingAmounts = useMemo(() => {
    let unassigned = Math.max(0, Math.round(Number(form.amount) * 100) || 0);
    return form.contributions.map(({ amount }) => {
      const value = amount ?? unassigned / 100;
      unassigned = Math.max(0, unassigned - (Math.round(Math.max(0, Number(value)) * 100) || 0));
      return value;
    });
  }, [form.amount, form.contributions]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ipos');
      if (res.ok) setIpos(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the live IPO list (NSE-backed) for the dropdown.
  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/ipo-list');
      if (res.ok) {
        const data = await res.json();
        setPresetIpos(Array.isArray(data.ipos) ? data.ipos : []);
        setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
        setPresetSource(data.source === 'live' ? 'live' : data.source === 'empty' ? 'empty' : 'unavailable');
      } else {
        setPresetSource('unavailable');
      }
    } catch (e) {
      console.error('Failed to load IPO list', e);
      setPresetSource('unavailable');
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') === '1') {
      const { entries, preset } = ipoDemo();
      setIsDemo(true);
      setIpos(entries);
      setPresetIpos([preset]);
      setPresetSource('live');
      setLoading(false);
      return;
    }
    loadData();
    loadPresets();
  }, [loadData, loadPresets]);

  useEffect(() => {
    if (!isModalOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [isModalOpen]);

  const formatRupee = (num: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num || 0);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

  const scheduleFor = (ipo: Ipo) => {
    const calendar = findIpoSchedule(schedules, ipo.ipoName, ipo.closeDate);
    return {
      allotmentDate: ipoDate(ipo.allotmentDate) ?? calendar?.allotmentDate,
      listingDate: ipoDate(ipo.listingDate) ?? calendar?.listingDate,
    };
  };

  // ---- Summary metrics ----
  const summary = useMemo(() => {
    const invested = ipos.reduce((s, i) => s + (i.amount || 0), 0);
    const returned = ipos.reduce((s, i) => s + (i.returnAmount || 0), 0);
    const profit = ipos.reduce((s, i) => s + (i.profitAmount || 0), 0);
    const allotted = ipos.filter(i => i.status === 'Allotted').length;
    return { invested, returned, profit, count: ipos.length, allotted };
  }, [ipos]);

  const filteredIpos = useMemo(
    () => (filter === 'all' ? ipos : ipos.filter(i => i.status === filter)),
    [ipos, filter]
  );

  // ---- Dynamic Account Balances (Refund Tracking) ----
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = { Mummy: 0, Papa: 0, Anshshikha: 0 };
    
    // Sort chronologically (oldest first) to compute running ledger
    const sorted = [...ipos].sort((a, b) => new Date(a.applyDate).getTime() - new Date(b.applyDate).getTime());
    
    sorted.forEach(ipo => {
      const applicant = ipo.appliedFrom;
      if (applicant === 'Mummy' || applicant === 'Papa' || applicant === 'Anshshikha') {
        // Funding that did NOT come from the applicant's own pending balance
        // (i.e. fresh money — self-funded or from someone else) reduces how much of
        // their existing balance this application actually used up.
        const newFunding = (ipo.contributions || [])
          .filter(c => normalizePerson(c.from) !== normalizePerson(applicant))
          .reduce((sum, c) => sum + (c.amount || 0), 0);
          
        // The remaining amount must come from the person's existing balance
        const usedFromBalance = Math.max(0, ipo.amount - newFunding);
        balances[applicant] = Math.max(0, balances[applicant] - usedFromBalance);
        
        // Refund keeps showing as an available balance until it's explicitly marked as returned
        if (!ipo.returnDate) {
          balances[applicant] += (ipo.returnAmount || 0);
        }
      }
    });
    
    return balances;
  }, [ipos]);

  // ---- Form helpers ----
  const openAdd = () => {
    setEditingId(null);
    setResultOnly(false);
    setForm(emptyForm());
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (ipo: Ipo, result?: 'Allotted' | 'Not Allotted') => {
    setEditingId(ipo._id);
    setResultOnly(Boolean(result));
    const preset = presetIpos.find(p => p.name === ipo.ipoName);
    const schedule = scheduleFor(ipo);
    const lots = ipo.lots && ipo.lots > 0 ? ipo.lots : 1;
    setForm({
      ipoName: ipo.ipoName,
      presetKey: preset ? ipo.ipoName : '__custom__',
      lots,
      perLotAmount: preset ? preset.amount : Math.round((ipo.amount || 0) / lots),
      amount: ipo.amount,
      appliedFrom: ipo.appliedFrom || 'Me',
      status: result ?? ipo.status,
      applyDate: ipo.applyDate ? ipo.applyDate.split('T')[0] : todayStr(),
      openDate: ipo.openDate || '',
      closeDate: ipo.closeDate || '',
      allotmentDate: schedule.allotmentDate || '',
      contributions: ipo.contributions?.length ? ipo.contributions.map(c => ({
        from: c.from,
        amount: c.amount,
        date: c.date ? c.date.split('T')[0] : todayStr(),
        returnDate: c.returnDate ? c.returnDate.split('T')[0] : '',
      })) : [emptyFundingRow()],
      returnAmount: ipo.returnAmount || (result === 'Not Allotted' ? ipo.amount : ''),
      returnDate: ipo.returnDate ? ipo.returnDate.split('T')[0] : '',
      listingDate: schedule.listingDate || '',
      profitAmount: ipo.profitAmount || '',
      notes: ipo.notes || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  // Selecting a preset IPO auto-fills its name + amount
  const handlePresetChange = (val: string) => {
    if (val === '__custom__') {
      setForm(f => ({
        ...f, presetKey: val, ipoName: '', perLotAmount: 0, amount: '',
        openDate: '', closeDate: '', allotmentDate: '', listingDate: '',
      }));
      return;
    }
    const preset = presetIpos.find(p => p.name === val);
    if (preset) {
      setForm(f => ({
        ...f,
        presetKey: val,
        ipoName: preset.name,
        perLotAmount: preset.amount,
        amount: preset.amount * f.lots, // lots × per-lot
        openDate: preset.openDate || '',
        closeDate: preset.closeDate || '',
        allotmentDate: preset.allotmentDate || '',
        listingDate: preset.listingDate || '',
      }));
    }
  };

  // Changing the number of lots recomputes the amount from the per-lot base.
  const handleLotsChange = (val: string) => {
    const lots = Math.max(1, Math.floor(Number(val) || 1));
    setForm(f => ({
      ...f,
      lots,
      amount: f.perLotAmount > 0 ? f.perLotAmount * lots : f.amount,
    }));
  };

  const addContribution = () =>
    setForm(f => ({
      ...f,
      contributions: [...f.contributions, emptyFundingRow()],
    }));

  const updateContribution = (idx: number, key: 'from' | 'amount' | 'date' | 'returnDate', value: string) =>
    setForm(f => ({
      ...f,
      contributions: f.contributions.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));

  const removeContribution = (idx: number) =>
    setForm(f => ({
      ...f,
      contributions: f.contributions.length > 1 ? f.contributions.filter((_, i) => i !== idx) : [emptyFundingRow()],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ipoName.trim()) {
      setError('Please select or enter an IPO name');
      return;
    }
    if (!form.applyDate) {
      setError('Please enter the application date');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      ipoName: form.ipoName.trim(),
      lots: Math.max(1, Math.floor(Number(form.lots) || 1)),
      amount: Number(form.amount) || 0,
      appliedFrom: form.appliedFrom,
      status: form.status,
      applyDate: new Date(form.applyDate).toISOString(),
      openDate: form.openDate || undefined,
      closeDate: form.closeDate || undefined,
      allotmentDate: form.allotmentDate || undefined,
      contributions: form.contributions
        .map((c, i) => ({ ...c, amount: fundingAmounts[i] }))
        .filter(c => c.from && Number(c.amount) > 0)
        .map(c => ({
          from: c.from,
          amount: Number(c.amount) || 0,
          date: new Date(c.date || form.applyDate).toISOString(),
          returnDate: c.returnDate ? new Date(c.returnDate).toISOString() : undefined,
        })),
      returnAmount: form.status === 'Not Allotted' && !isSelfFunded ? Number(form.returnAmount) || 0 : 0,
      returnDate: form.status === 'Not Allotted' && !isSelfFunded && form.returnDate ? new Date(form.returnDate).toISOString() : undefined,
      listingDate: form.listingDate || undefined,
      profitAmount: form.status === 'Allotted' ? Number(form.profitAmount) || 0 : 0,
      notes: form.notes.trim(),
    };

    try {
      if (isDemo) {
        const entry = { ...payload, _id: editingId ?? crypto.randomUUID(), createdAt: new Date().toISOString() };
        setIpos(prev => editingId ? prev.map(ipo => ipo._id === editingId ? { ...ipo, ...payload } : ipo) : [entry, ...prev]);
        setIsModalOpen(false);
        return;
      }
      const res = await fetch('/api/ipos', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (res.ok) {
        await loadData();
        setIsModalOpen(false);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save IPO');
      }
    } catch (err) {
      console.error(err);
      setError('Error connecting to server');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ipo: Ipo) => {
    if (!window.confirm(`Delete IPO entry "${ipo.ipoName}"?`)) return;
    if (isDemo) {
      setIpos(prev => prev.filter(i => i._id !== ipo._id));
      return;
    }
    try {
      const res = await fetch(`/api/ipos?id=${ipo._id}`, { method: 'DELETE' });
      if (res.ok) {
        setIpos(prev => prev.filter(i => i._id !== ipo._id));
      } else {
        alert('Failed to delete IPO');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting IPO');
    }
  };

  // No refund to track when the money never actually left the applicant's own pocket —
  // i.e. every contribution's source is the same person as who the IPO was applied from.
  const isSelfFunded = form.contributions.every((c, i) =>
    !c.from || Number(fundingAmounts[i]) <= 0 || normalizePerson(c.from) === normalizePerson(form.appliedFrom),
  );

  const setAllotment = (result: 'Allotted' | 'Not Allotted') => {
    setForm(f => ({
      ...f,
      status: result,
      returnAmount: result === 'Not Allotted' && !f.returnAmount ? f.amount : f.returnAmount,
    }));
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'Allotted':
        return { cls: 'text-green-400 bg-green-500/15 border-green-500/30', Icon: CheckCircle2 };
      case 'Not Allotted':
        return { cls: 'text-[#FF5A5F] bg-[#FF5A5F]/10 border-[#FF5A5F]/25', Icon: XCircle };
      default:
        return { cls: 'text-gold-400 bg-gold-400/10 border-gold-400/25', Icon: Clock };
    }
  };

  return (
    <>
      <div className={style.page}>
        {/* Header */}
        <div className={style.header}>
          <div className="min-w-0">
            <h1 className={style.title}>IPO portfolio</h1>
            <p className={style.sub}>Applications, allotments and returns.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={isDemo ? '/ipo' : '/ipo?demo=1'} className={style.tool}>
              {isDemo ? 'Back to portfolio' : 'Try IPO demo'}
            </a>
            <button
              onClick={openAdd}
              className={`${style.action} flex items-center justify-center gap-1.5 text-sm font-semibold bg-gold-400 text-black hover:bg-gold-500`}
            >
              <Plus className="h-4 w-4" />
              Add IPO
            </button>
          </div>
        </div>

        {isDemo && (
          <p className="mb-5 rounded-xl border border-gold-400/25 bg-gold-400/5 px-4 py-3 text-sm text-gold-400">
            Demo portfolio. Add Cedar Grid or update a sample result. Changes reset when you reload.
          </p>
        )}

        {/* Summary cards */}
        <div className={style.metricStrip}>
          {[
            { label: 'Total Applied', value: formatRupee(summary.invested), Icon: Wallet, accent: 'text-white' },
            { label: 'Total Profit', value: formatRupee(summary.profit), Icon: TrendingUp, accent: summary.profit >= 0 ? 'text-green-400' : 'text-[#FF5A5F]' },
            { label: 'Total Refunded', value: formatRupee(summary.returned), Icon: ArrowDownLeft, accent: 'text-gold-400' },
            { label: 'Allotted', value: String(summary.allotted), Icon: CheckCircle2, accent: 'text-green-400' },
          ].map(card => (
            <div key={card.label} className={style.metric}>
              <div className={style.metricLabel}>
                <card.Icon className="h-3.5 w-3.5" />
                {card.label}
              </div>
              <strong className={card.accent}>{card.value}</strong>
            </div>
          ))}
        </div>

        {/* Active Account Balances (Refunds sitting in accounts) */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 mb-6 shadow-luxury">
          <h2 className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-bold mb-3 flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-gold-400" />
            Available refunds
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {['Mummy', 'Papa', 'Anshshikha'].map(acc => {
              const bal = accountBalances[acc] || 0;
              return (
                <div key={acc} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 flex flex-wrap gap-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white">{acc}'s Account</span>
                    <span className="block text-xs text-[#8A8A8A] mt-0.5">Available for next IPO</span>
                  </div>
                  <span className={`text-sm sm:text-base font-bold font-mono tabular-nums tracking-tight ${bal > 0 ? 'text-gold-400' : 'text-[#555555]'}`}>
                    {formatRupee(bal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-black p-1 rounded-xl border border-white/[0.08] w-full sm:w-fit mb-5 overflow-x-auto">
          {(['all', 'Applied', 'Allotted', 'Not Allotted'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize tracking-wide transition-all whitespace-nowrap ${
                filter === s
                  ? 'bg-gold-400/10 border border-gold-400/20 text-gold-400'
                  : 'text-[#8A8A8A] hover:text-white border border-transparent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16 text-[#555555]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredIpos.length === 0 ? (
          <div className="text-center py-16 bg-[#111111] border border-white/[0.06] rounded-2xl">
            <TrendingUp className="h-10 w-10 text-[#333333] mx-auto mb-3" />
            <p className="text-sm text-[#8A8A8A]">No IPO entries yet.</p>
            <button onClick={openAdd} className="mt-4 text-xs font-semibold text-gold-400 hover:text-gold-500">
              + Add your first IPO
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIpos.map(ipo => {
              const { cls, Icon } = statusStyle(ipo.status);
              const { allotmentDate, listingDate } = scheduleFor(ipo);
              const resultReady = ipo.status === 'Applied' && canSetResult(allotmentDate, ipo.closeDate);
              const takenTotal = (ipo.contributions || []).reduce((s, c) => s + (c.amount || 0), 0);
              const preset = presetIpos.find(p => {
                const n1 = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const n2 = ipo.ipoName.toLowerCase().replace(/[^a-z0-9]/g, '');
                return n1.includes(n2) || n2.includes(n1);
              });
              return (
                <div
                  key={ipo._id}
                  className="rounded-2xl border border-white/[0.06] bg-[#151515] hover:bg-[#1A1A1A] transition-all p-4 sm:p-5"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white text-base truncate">{ipo.ipoName}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${cls}`}>
                          <Icon className="h-3 w-3" />
                          {ipo.status}
                        </span>
                        {preset && preset.gmp !== undefined && (
                          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-0.5 ${
                            preset.gmpDirection === 'up'
                              ? 'text-[#4ADE80] bg-[#4ADE80]/10 border-[#4ADE80]/20'
                              : 'text-[#FF5A5F] bg-[#FF5A5F]/10 border-[#FF5A5F]/20'
                          }`}>
                            GMP: {preset.gmpDirection === 'up' ? '▲' : '▼'} ₹{preset.gmp}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8A8A8A] mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(ipo.applyDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          Applied from <span className="text-white/80 font-medium">{ipo.appliedFrom}</span>
                        </span>
                        {(ipo.openDate || ipo.closeDate) && (
                          <span className="flex items-center gap-1">
                            Open/Close: <span className="text-white/70">{ipo.openDate || '—'} → {ipo.closeDate || '—'}</span>
                          </span>
                        )}
                      </div>

                      {ipo.status === 'Applied' && (
                        <div className={style.ipoResultBar}>
                          <span className="flex items-center gap-2">
                            <Calendar size={15} aria-hidden="true" />
                            {allotmentDate ? `Allotment · ${formatDate(allotmentDate)}` : 'Allotment date unavailable'}
                          </span>
                          {resultReady && (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className={style.ipoOutcome} data-outcome="yes"
                                onClick={() => openEdit(ipo, 'Allotted')}>Allotted</button>
                              <button type="button" className={style.ipoOutcome} data-outcome="no"
                                onClick={() => openEdit(ipo, 'Not Allotted')}>Not Allotted</button>
                            </div>
                          )}
                        </div>
                      )}
                      {ipo.status === 'Allotted' && (
                        <div className={style.ipoResultBar}>
                          <span className="flex items-center gap-2">
                            <Calendar size={15} aria-hidden="true" />
                            {listingDate ? `Listing · ${formatDate(listingDate)}` : 'Listing date unavailable'}
                          </span>
                        </div>
                      )}

                      {/* Contributions */}
                      {ipo.contributions && ipo.contributions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {ipo.contributions.map((c, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#C9C9C9]"
                            >
                              <span className="text-gold-400 font-medium">{c.from}</span>{' '}
                              {formatRupee(c.amount)}
                              <span className="text-[#555555]"> · {formatDate(c.date)}</span>
                              {c.returnDate && (
                                <span className="text-green-400/80"> · return {formatDate(c.returnDate)}</span>
                              )}
                            </span>
                          ))}
                          {takenTotal > 0 && (
                            <span className="text-[10px] px-2 py-1 rounded-lg bg-black text-[#8A8A8A] border border-white/[0.06]">
                              Taken: {formatRupee(takenTotal)}
                            </span>
                          )}
                        </div>
                      )}

                      {ipo.notes && (
                        <p className="mt-2.5 text-xs italic text-[#555555] truncate">"{ipo.notes}"</p>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block">
                          Applied{ipo.lots > 1 ? ` · ${ipo.lots} lots` : ''}
                        </span>
                        <span className="text-lg font-bold font-mono tabular-nums text-white">
                          {formatRupee(ipo.amount)}
                        </span>
                        {ipo.status === 'Not Allotted' && ipo.returnAmount > 0 && (
                          <span className="block text-[11px] font-mono text-gold-400 mt-0.5">
                            + {formatRupee(ipo.returnAmount)} refunded
                          </span>
                        )}
                        {ipo.status === 'Not Allotted' && ipo.returnDate && (
                          <span className="block text-[10px] text-[#8A8A8A] mt-0.5">
                            by {formatDate(ipo.returnDate)}
                          </span>
                        )}
                        {ipo.status === 'Allotted' && !!ipo.profitAmount && (
                          <span className={`block text-[11px] font-mono mt-0.5 ${ipo.profitAmount >= 0 ? 'text-green-400' : 'text-[#FF5A5F]'}`}>
                            {ipo.profitAmount >= 0 ? '+' : ''}{formatRupee(ipo.profitAmount)} profit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(ipo)}
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#8A8A8A] hover:text-gold-400 hover:border-gold-400/30 transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ipo)}
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#8A8A8A] hover:text-[#FF5A5F] hover:border-[#FF5A5F]/30 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              role="dialog" aria-modal="true" aria-label="IPO application"
              onKeyDown={event => { if (event.key === 'Escape') setIsModalOpen(false); }}
              className={`${style.sheet} ${style.ipoSheet}`}
            >
              {/* Sticky header */}
              <div className={`${style.sheetHead} ${style.ipoSheetHead}`}>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gold-400/10 border border-gold-400/25 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4.5 w-4.5 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight">
                      {resultOnly ? 'Update result' : editingId ? 'Edit IPO' : 'Add IPO'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close IPO form"
                  autoFocus
                  className="p-2 rounded-xl text-[#8A8A8A] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className={style.ipoSheetBody}>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2.5 text-xs text-[#FF5A5F] overflow-hidden"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

              <form onSubmit={handleSubmit} className={style.ipoForm}>
                <section hidden={resultOnly} className={style.ipoSection}>
                  <h4>Application</h4>

                {/* IPO select */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ipo-preset">
                      Select IPO
                    </label>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                      presetSource === 'live'
                        ? 'text-green-400 bg-green-500/10 border-green-500/25'
                        : presetSource === 'loading'
                        ? 'text-[#8A8A8A] bg-white/[0.04] border-white/[0.08]'
                        : 'text-gold-400 bg-gold-400/10 border-gold-400/25'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        presetSource === 'live' ? 'bg-green-400 animate-pulse'
                        : presetSource === 'loading' ? 'bg-[#555555] animate-pulse'
                        : 'bg-gold-400'
                      }`} />
                      {presetSource === 'live' ? (isDemo ? 'DEMO' : `LIVE · ${presetIpos.length}`)
                        : presetSource === 'loading' ? 'LOADING…'
                        : presetSource === 'empty' ? 'NO OPEN IPO'
                        : 'LIVE UNAVAILABLE'}
                    </span>
                  </div>
                  <select
                    id="ipo-preset"
                    value={form.presetKey}
                    onChange={e => handlePresetChange(e.target.value)}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                  >
                    <option value="">
                      {presetSource === 'live' ? '— Choose a live IPO —' : '— Add manually below —'}
                    </option>
                    {presetIpos.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.board === 'SME' ? ' [SME]' : ''}
                        {p.priceBand ? ` · ${p.priceBand}` : ''}
                        {p.gmp !== undefined ? ` · GMP: ${p.gmpDirection === 'up' ? '+' : '-'}₹${p.gmp}` : ''}
                      </option>
                    ))}
                    <option value="__custom__">Other (type manually)</option>
                  </select>
                  {presetSource !== 'live' && presetSource !== 'loading' && (
                    <p className="mt-1.5 text-[10px] text-[#8A8A8A]">
                      {presetSource === 'empty'
                        ? 'No live IPOs are available right now. Pick "Other" to add one manually.'
                        : 'Couldn\'t load the live IPO list. Pick "Other" to add manually.'}
                    </p>
                  )}
                  {(() => {
                    const sel = presetIpos.find(p => p.name === form.presetKey);
                    return sel && (sel.openDate || sel.closeDate) ? (
                      <p className="mt-1.5 text-[10px] text-[#8A8A8A]">
                        Open: <span className="text-white/70">{sel.openDate || '—'}</span> · Close:{' '}
                        <span className="text-white/70">{sel.closeDate || '—'}</span>
                        {' '}· Est. 1-lot amount auto-filled
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* Custom name if "Other" */}
                {form.presetKey === '__custom__' && (
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      IPO Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Some New IPO Ltd"
                      value={form.ipoName}
                      onChange={e => setForm(f => ({ ...f, ipoName: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                    />
                  </div>
                )}

                <div className={style.ipoApplicationGrid}>
                  {/* Lots (default 1) */}
                  <div>
                    <label htmlFor="ipo-lots">
                      Lots
                    </label>
                    <select
                      id="ipo-lots"
                      value={form.lots}
                      onChange={e => handleLotsChange(e.target.value)}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  {/* Amount (auto = lots × per-lot) */}
                  <div>
                    <label htmlFor="ipo-amount">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      id="ipo-amount"
                      step="0.01"
                      placeholder="Application amount"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                    />
                  </div>
                  {/* Applied From */}
                  <div>
                    <label htmlFor="ipo-applied-from">
                      Applied From
                    </label>
                    <select
                      id="ipo-applied-from"
                      value={form.appliedFrom}
                      onChange={e => setForm(f => ({ ...f, appliedFrom: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      {APPLIED_FROM.map(a => {
                        const bal = accountBalances[a] || 0;
                        return (
                          <option key={a} value={a}>
                            {a}{bal > 0 ? ` (Bal: ₹${bal})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                {form.perLotAmount > 0 && (
                  <p className="-mt-2 text-[10px] text-[#8A8A8A]">
                    Suggested · {form.lots} lot{form.lots > 1 ? 's' : ''} × {formatRupee(form.perLotAmount)} = {formatRupee(form.perLotAmount * form.lots)}
                  </p>
                )}

                </section>

                <section hidden={resultOnly} className={style.ipoSection}>
                  <h4>Funding</h4>


                  {form.contributions.map((row, i) => {
                    const legacyName = row.from && !TAKEN_FROM_OPTIONS.some(option => option.value === row.from);
                    return (
                      <div key={i} className={style.ipoFundingRow}>
                        <div className={style.ipoFieldGrid}>
                          <div>
                            <label htmlFor={`funding-from-${i}`}>Amount taken from</label>
                            <select id={`funding-from-${i}`} value={row.from}
                              onChange={e => updateContribution(i, 'from', e.target.value)}>
                              <option value="">Select person</option>
                              {TAKEN_FROM_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                              {legacyName && <option value={row.from}>{row.from}</option>}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`funding-amount-${i}`}>Amount (₹)</label>
                            <input id={`funding-amount-${i}`} type="number" min="0" step="0.01"
                              value={fundingAmounts[i] === 0 && row.amount === null && !form.amount ? '' : fundingAmounts[i]}
                              onChange={e => updateContribution(i, 'amount', e.target.value)} />
                          </div>
                        </div>
                        {(row.from || i > 0) && (
                          <div className="flex items-end gap-3">
                            {row.from && <div>
                              <label htmlFor={`funding-date-${i}`}>Taken on</label>
                              <input id={`funding-date-${i}`} type="date" value={row.date}
                                onChange={e => updateContribution(i, 'date', e.target.value)} />
                            </div>}
                            <button type="button" onClick={() => removeContribution(i)}
                              className={style.ipoRemovePerson} aria-label={`Remove funding person ${i + 1}`}>
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={addContribution} className={style.ipoAddPerson}>
                    <Plus size={16} aria-hidden="true" /> Add person
                  </button>

                {/* Available balance tip */}
                <AnimatePresence>
                  {(form.appliedFrom === 'Mummy' || form.appliedFrom === 'Papa' || form.appliedFrom === 'Anshshikha') && (accountBalances[form.appliedFrom] || 0) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="text-[10px] leading-relaxed text-gold-400/90 bg-gold-400/[0.03] border border-gold-400/10 rounded-xl p-3">
                        💡 <strong>Refund Balance Alert:</strong> {form.appliedFrom}'s account currently holds <strong>{formatRupee(accountBalances[form.appliedFrom])}</strong> of your money from previous unallotted IPO returns. If you are reusing this existing balance for this application, <strong>don't add a new "Amount Taken From" entry</strong> — it's already sitting there.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </section>

                <section hidden={resultOnly} className={style.ipoSection}>
                <div className={style.ipoFieldGrid}>
                  <div>
                    <label htmlFor="ipo-apply-date">Application date</label>
                    <input id="ipo-apply-date" type="date" required value={form.applyDate}
                      onChange={e => setForm(f => ({ ...f, applyDate: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="ipo-allotment-date">Allotment date</label>
                    <input id="ipo-allotment-date" type="date" value={form.allotmentDate}
                      onChange={e => setForm(f => ({ ...f, allotmentDate: e.target.value }))} />
                  </div>
                </div>
                </section>

                {editingId && (
                  <section className={style.ipoSection}>
                    <h4>{resultOnly ? form.ipoName : 'Allotment result'}</h4>
                    {form.allotmentDate && (
                      <p className="text-sm text-[#a8b8ab]">
                        Allotment · {formatDate(form.allotmentDate)}
                      </p>
                    )}
                    {form.status !== 'Applied' || canSetResult(form.allotmentDate, form.closeDate) ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={style.ipoOutcome} aria-pressed={form.status === 'Applied'}
                          onClick={() => setForm(f => ({ ...f, status: 'Applied' }))}>Pending</button>
                        <button type="button" className={style.ipoOutcome} data-outcome="yes"
                          aria-pressed={form.status === 'Allotted'}
                          onClick={() => setAllotment('Allotted')}>Allotted</button>
                        <button type="button" className={style.ipoOutcome} data-outcome="no"
                          aria-pressed={form.status === 'Not Allotted'}
                          onClick={() => setAllotment('Not Allotted')}>Not Allotted</button>
                      </div>
                    ) : (
                      <p className="text-sm text-[#a8b8ab]">Result can be updated when allotment is due.</p>
                    )}

                <AnimatePresence mode="wait">
                {/* Not Allotted → refund tracking (skipped when the money never left the applicant's own pocket) */}
                {form.status === 'Not Allotted' && !isSelfFunded && (
                  <motion.div
                    key="refund"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="grid grid-cols-2 gap-3 rounded-xl border border-[#FF5A5F]/15 bg-[#FF5A5F]/[0.03] p-3.5"
                  >
                    <div className="col-span-2 text-[10px] text-[#FF5A5F]/90 font-semibold uppercase tracking-wider -mb-1 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Refund
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                        Return Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Refund amount"
                        value={form.returnAmount}
                        onChange={e => setForm(f => ({ ...f, returnAmount: e.target.value }))}
                        className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                        Return Date
                      </label>
                      <input
                        type="date"
                        value={form.returnDate}
                        onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))}
                        className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, returnDate: todayStr() }))}
                      className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold bg-[#FF5A5F]/10 border border-[#FF5A5F]/25 text-[#FF5A5F] hover:bg-[#FF5A5F]/20 transition-all"
                    >
                      {form.returnDate ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {form.returnDate ? `Marked Returned · ${form.returnDate}` : 'Mark as Returned'}
                    </motion.button>
                  </motion.div>
                )}

                {/* Allotted → listing profit tracking */}
                {form.status === 'Allotted' && (
                  <motion.div
                    key="listing"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="grid grid-cols-2 gap-3 rounded-xl border border-green-500/15 bg-green-500/[0.03] p-3.5"
                  >
                    <div className="col-span-2 text-[10px] text-green-400/90 font-semibold uppercase tracking-wider -mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Listing
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                        Profit Amount (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="Profit (or negative for loss)"
                        value={form.profitAmount}
                        onChange={e => setForm(f => ({ ...f, profitAmount: e.target.value }))}
                        className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="ipo-listing-date">
                        Listing Date
                      </label>
                      <input
                        type="date"
                        id="ipo-listing-date"
                        value={form.listingDate}
                        onChange={e => setForm(f => ({ ...f, listingDate: e.target.value }))}
                        className="w-full rounded-xl bg-black border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                      />
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
                  </section>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                    Notes <span className="normal-case text-[#555555]">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any details..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none resize-none"
                  />
                </div>

                <div className={style.ipoSheetFooter}>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#8A8A8A] hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 flex items-center gap-1.5 disabled:opacity-50 shadow-[0_0_20px_-4px_rgba(250,204,21,0.4)]"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {editingId ? 'Save Changes' : 'Add IPO'}
                  </motion.button>
                </div>
              </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
