'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Plus, Pencil, Trash2, Loader2, Calendar, User,
  X, CheckCircle2, Clock, XCircle, Wallet, ArrowDownLeft
} from 'lucide-react';
import { Ipo, IpoContribution } from '@/types';

// Preset IPO shape. Live list is loaded from /api/ipo-list (NSE-backed);
// this small static set is only the initial fallback before that resolves.
type PresetIpo = {
  name: string;
  amount: number;
  priceBand?: string;
  openDate?: string;
  closeDate?: string;
  source?: string;
};

const FALLBACK_PRESETS: PresetIpo[] = [
  { name: 'Tata Technologies', amount: 15000 },
  { name: 'Swiggy', amount: 14820 },
  { name: 'Hyundai Motor India', amount: 14970 },
  { name: 'Bajaj Housing Finance', amount: 14980 },
  { name: 'LIC of India', amount: 14805 },
  { name: 'Zomato', amount: 14820 },
];

const APPLIED_FROM = ['Me', 'Mummy', 'Papa'];
const STATUSES = ['Applied', 'Allotted', 'Not Allotted'] as const;

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  ipoName: '',
  presetKey: '',
  amount: '' as string | number,
  appliedFrom: 'Me',
  status: 'Applied' as (typeof STATUSES)[number],
  applyDate: todayStr(),
  contributions: [] as { from: string; amount: string | number; date: string }[],
  returnAmount: '' as string | number,
  notes: '',
});

export default function IpoPage() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [presetIpos, setPresetIpos] = useState<PresetIpo[]>(FALLBACK_PRESETS);
  const [presetSource, setPresetSource] = useState<'live' | 'static'>('static');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Applied' | 'Allotted' | 'Not Allotted'>('all');

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
        if (Array.isArray(data.ipos) && data.ipos.length) {
          setPresetIpos(data.ipos);
          setPresetSource(data.source === 'live' ? 'live' : 'static');
        }
      }
    } catch (e) {
      console.error('Failed to load IPO list', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadPresets();
  }, [loadData, loadPresets]);

  const formatRupee = (num: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num || 0);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ---- Summary metrics ----
  const summary = useMemo(() => {
    const invested = ipos.reduce((s, i) => s + (i.amount || 0), 0);
    const returned = ipos.reduce((s, i) => s + (i.returnAmount || 0), 0);
    const allotted = ipos.filter(i => i.status === 'Allotted').length;
    return { invested, returned, count: ipos.length, allotted };
  }, [ipos]);

  const filteredIpos = useMemo(
    () => (filter === 'all' ? ipos : ipos.filter(i => i.status === filter)),
    [ipos, filter]
  );

  // ---- Form helpers ----
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (ipo: Ipo) => {
    setEditingId(ipo._id);
    const preset = presetIpos.find(p => p.name === ipo.ipoName);
    setForm({
      ipoName: ipo.ipoName,
      presetKey: preset ? ipo.ipoName : '__custom__',
      amount: ipo.amount,
      appliedFrom: ipo.appliedFrom || 'Me',
      status: ipo.status,
      applyDate: ipo.applyDate ? ipo.applyDate.split('T')[0] : todayStr(),
      contributions: (ipo.contributions || []).map(c => ({
        from: c.from,
        amount: c.amount,
        date: c.date ? c.date.split('T')[0] : todayStr(),
      })),
      returnAmount: ipo.returnAmount || '',
      notes: ipo.notes || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  // Selecting a preset IPO auto-fills its name + amount
  const handlePresetChange = (val: string) => {
    if (val === '__custom__') {
      setForm(f => ({ ...f, presetKey: val, ipoName: '', amount: '' }));
      return;
    }
    const preset = presetIpos.find(p => p.name === val);
    if (preset) {
      setForm(f => ({ ...f, presetKey: val, ipoName: preset.name, amount: preset.amount }));
    }
  };

  const addContribution = () =>
    setForm(f => ({ ...f, contributions: [...f.contributions, { from: 'Mummy', amount: '', date: todayStr() }] }));

  const updateContribution = (idx: number, key: 'from' | 'amount' | 'date', value: string) =>
    setForm(f => ({
      ...f,
      contributions: f.contributions.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));

  const removeContribution = (idx: number) =>
    setForm(f => ({ ...f, contributions: f.contributions.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ipoName.trim()) {
      setError('Please select or enter an IPO name');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      ipoName: form.ipoName.trim(),
      amount: Number(form.amount) || 0,
      appliedFrom: form.appliedFrom,
      status: form.status,
      applyDate: new Date(form.applyDate).toISOString(),
      contributions: form.contributions
        .filter(c => c.from && Number(c.amount) > 0)
        .map(c => ({
          from: c.from,
          amount: Number(c.amount) || 0,
          date: new Date(c.date).toISOString(),
        })),
      returnAmount: Number(form.returnAmount) || 0,
      notes: form.notes.trim(),
    };

    try {
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
      <div className="overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2 sm:gap-3">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-gold-400 shrink-0" />
              IPO Tracker
            </h1>
            <p className="text-xs text-[#8A8A8A] mt-1">
              Track your IPO applications, who funded them and returns.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md w-full md:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add IPO
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Total Applied', value: formatRupee(summary.invested), Icon: Wallet, accent: 'text-white' },
            { label: 'Total Returned', value: formatRupee(summary.returned), Icon: ArrowDownLeft, accent: 'text-green-400' },
            { label: 'IPOs', value: String(summary.count), Icon: TrendingUp, accent: 'text-gold-400' },
            { label: 'Allotted', value: String(summary.allotted), Icon: CheckCircle2, accent: 'text-green-400' },
          ].map(card => (
            <div key={card.label} className="bg-[#111111] border border-white/[0.06] rounded-2xl p-4 shadow-luxury">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8A8A8A] font-medium mb-1.5">
                <card.Icon className="h-3.5 w-3.5" />
                {card.label}
              </div>
              <span className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums tracking-tight ${card.accent}`}>
                {card.value}
              </span>
            </div>
          ))}
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
              const takenTotal = (ipo.contributions || []).reduce((s, c) => s + (c.amount || 0), 0);
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
                      </div>

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
                        <span className="text-[9px] uppercase tracking-wider text-[#8A8A8A] block">Applied</span>
                        <span className="text-lg font-bold font-mono tabular-nums text-white">
                          {formatRupee(ipo.amount)}
                        </span>
                        {ipo.returnAmount > 0 && (
                          <span className="block text-[11px] font-mono text-green-400 mt-0.5">
                            + {formatRupee(ipo.returnAmount)} returned
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111111] border border-white/[0.06] p-6 text-white shadow-luxury z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-gold-400" />
                  {editingId ? 'Edit IPO' : 'Add IPO'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-[#8A8A8A] hover:text-white hover:bg-white/[0.05]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-2.5 text-xs text-[#FF5A5F]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* IPO select */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
                      Select IPO
                    </label>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                      presetSource === 'live'
                        ? 'text-green-400 bg-green-500/10 border-green-500/25'
                        : 'text-[#8A8A8A] bg-white/[0.04] border-white/[0.08]'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${presetSource === 'live' ? 'bg-green-400 animate-pulse' : 'bg-[#555555]'}`} />
                      {presetSource === 'live' ? 'LIVE (NSE)' : 'OFFLINE LIST'}
                    </span>
                  </div>
                  <select
                    value={form.presetKey}
                    onChange={e => handlePresetChange(e.target.value)}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                  >
                    <option value="">— Choose an IPO —</option>
                    {presetIpos.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name}{p.priceBand ? ` (${p.priceBand})` : ''}
                      </option>
                    ))}
                    <option value="__custom__">Other (type manually)</option>
                  </select>
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

                <div className="grid grid-cols-2 gap-3">
                  {/* Amount (auto-filled) */}
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Auto"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                    />
                  </div>
                  {/* Applied From */}
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Applied From
                    </label>
                    <select
                      value={form.appliedFrom}
                      onChange={e => setForm(f => ({ ...f, appliedFrom: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      {APPLIED_FROM.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Status */}
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as (typeof STATUSES)[number] }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {/* Apply date */}
                  <div>
                    <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                      Apply Date
                    </label>
                    <input
                      type="date"
                      value={form.applyDate}
                      onChange={e => setForm(f => ({ ...f, applyDate: e.target.value }))}
                      className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Contributions — amount taken from */}
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
                      Amount Taken From
                    </label>
                    <button
                      type="button"
                      onClick={addContribution}
                      className="flex items-center gap-1 text-[11px] font-semibold text-gold-400 hover:text-gold-500"
                    >
                      <Plus className="h-3 w-3" /> Add person
                    </button>
                  </div>

                  {form.contributions.length === 0 ? (
                    <p className="text-[11px] text-[#555555]">No one added. Add if money was taken from someone.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {form.contributions.map((c, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={c.from}
                            onChange={e => updateContribution(idx, 'from', e.target.value)}
                            className="col-span-4 rounded-lg bg-black border border-white/[0.08] px-2 py-2 text-xs text-white focus:border-gold-400/40 focus:outline-none"
                          >
                            {['Me', 'Mummy', 'Papa', 'Other'].map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            placeholder="Amount"
                            value={c.amount}
                            onChange={e => updateContribution(idx, 'amount', e.target.value)}
                            className="col-span-3 rounded-lg bg-black border border-white/[0.08] px-2 py-2 text-xs text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                          />
                          <input
                            type="date"
                            value={c.date}
                            onChange={e => updateContribution(idx, 'date', e.target.value)}
                            className="col-span-4 rounded-lg bg-black border border-white/[0.08] px-1.5 py-2 text-[11px] text-white focus:border-gold-400/40 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeContribution(idx)}
                            className="col-span-1 flex justify-center text-[#555555] hover:text-[#FF5A5F]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Return amount */}
                <div>
                  <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                    Return Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Refund / amount returned"
                    value={form.returnAmount}
                    onChange={e => setForm(f => ({ ...f, returnAmount: e.target.value }))}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] text-[#8A8A8A] uppercase tracking-wider mb-1.5 font-medium">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any details..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#8A8A8A] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {editingId ? 'Save Changes' : 'Add IPO'}
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
