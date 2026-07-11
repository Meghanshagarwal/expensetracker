'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Edit2, Check, X, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Form states for dropdown arrays
  const [categories, setCategories] = useState<string[]>([]);
  const [upiApps, setUpiApps] = useState<string[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<string[]>([]);
  const [upiAccounts, setUpiAccounts] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);

  // Input states for adding new options
  const [newCategory, setNewCategory] = useState('');
  const [newUpiApp, setNewUpiApp] = useState('');
  const [newSourceAccount, setNewSourceAccount] = useState('');
  const [newUpiAccount, setNewUpiAccount] = useState('');
  const [newVehicle, setNewVehicle] = useState('');

  // Editing state
  const [editingItem, setEditingItem] = useState<{ section: string; index: number; value: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // First try local storage
        const local = localStorage.getItem('app_dropdown_settings');
        if (local) {
          const parsed = JSON.parse(local);
          setCategories(parsed.categories || []);
          setUpiApps(parsed.upiApps || []);
          setSourceAccounts(parsed.sourceAccounts || []);
          setUpiAccounts(parsed.upiAccounts || []);
          setVehicles(parsed.vehicles || []);
        }

        // Fetch from API
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setUpiApps(data.upiApps || []);
          setSourceAccounts(data.sourceAccounts || []);
          setUpiAccounts(data.upiAccounts || []);
          setVehicles(data.vehicles || []);
          
          // Save to local storage for offline use
          localStorage.setItem('app_dropdown_settings', JSON.stringify({
            categories: data.categories,
            upiApps: data.upiApps,
            sourceAccounts: data.sourceAccounts,
            upiAccounts: data.upiAccounts,
            vehicles: data.vehicles
          }));
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
        setError('Failed to load settings from server. Displaying local data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload = {
      categories,
      upiApps,
      sourceAccounts,
      upiAccounts,
      vehicles
    };

    try {
      // Always save to localStorage first (offline friendly)
      localStorage.setItem('app_dropdown_settings', JSON.stringify(payload));

      if (navigator.onLine) {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error('Failed to save settings on server');
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  // Add helpers
  const handleAdd = (section: 'categories' | 'upiApps' | 'sourceAccounts' | 'vehicles', value: string, setter: React.Dispatch<React.SetStateAction<string[]>>, inputSetter: React.Dispatch<React.SetStateAction<string>>) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setter(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
    inputSetter('');
  };

  // Delete helpers
  const handleDelete = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (!window.confirm(`Are you sure you want to remove "${item}" from the dropdown list?`)) return;
    setter(prev => prev.filter(x => x !== item));
  };

  // Start editing
  const startEdit = (section: string, index: number, value: string) => {
    setEditingItem({ section, index, value });
  };

  // Save edit
  const saveEdit = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!editingItem || !editingItem.value.trim()) return;
    const newVal = editingItem.value.trim();
    setter(prev => prev.map((x, i) => i === editingItem.index ? newVal : x));
    setEditingItem(null);
  };

  // Input styles
  const inputClass = "flex-1 rounded-xl bg-black border border-white/[0.08] px-3.5 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-gold-400/40 focus:outline-none font-normal";
  const btnClass = "px-4 py-2.5 bg-gold-400 hover:bg-gold-500 text-black rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0";

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32 text-[#555555]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderSection = (
    title: string,
    items: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    newValue: string,
    inputSetter: React.Dispatch<React.SetStateAction<string>>,
    sectionKey: string
  ) => {
    return (
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-luxury">
        <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
        
        {/* Add Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}...`}
            value={newValue}
            onChange={(e) => inputSetter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd(sectionKey as any, newValue, setter, inputSetter);
              }
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => handleAdd(sectionKey as any, newValue, setter, inputSetter)}
            className={btnClass}
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>

        {/* List of items */}
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {items.map((item, idx) => {
            const isEditing = editingItem && editingItem.section === sectionKey && editingItem.index === idx;
            return (
              <div key={idx} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] rounded-xl px-4 py-2.5 transition-all">
                {isEditing ? (
                  <input
                    type="text"
                    value={editingItem.value}
                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, value: e.target.value } : null)}
                    className="flex-1 bg-black border border-gold-400/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="text-xs text-[#C9C9C9] font-medium">{item}</span>
                )}

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(setter)}
                        className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingItem(null)}
                        className="p-1.5 rounded-lg text-[#FF5A5F] hover:bg-[#FF5A5F]/10 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(sectionKey, idx, item)}
                        className="p-1.5 rounded-lg text-[#8A8A8A] hover:text-gold-400 hover:bg-white/[0.04] transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(setter, item)}
                        className="p-1.5 rounded-lg text-[#8A8A8A] hover:text-[#FF5A5F] hover:bg-white/[0.04] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-gold-400" />
            Dropdown Settings
          </h1>
          <p className="text-xs text-[#8A8A8A] mt-1">
            Customize category, UPI apps, source account, and vehicle dropdown options.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-semibold bg-gold-400 text-black hover:bg-gold-500 transition-all shadow-md disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Save Settings</span>
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-3 text-xs text-[#FF5A5F]">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-400">
          ✓ Dropdown settings saved successfully! Changes are applied instantly.
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderSection('Categories', categories, setCategories, newCategory, setNewCategory, 'categories')}
        {renderSection('UPI Apps', upiApps, setUpiApps, newUpiApp, setNewUpiApp, 'upiApps')}
        {renderSection('Source Accounts', sourceAccounts, setSourceAccounts, newSourceAccount, setNewSourceAccount, 'sourceAccounts')}
        {renderSection('UPI Bank Accounts (Linked)', upiAccounts, setUpiAccounts, newUpiAccount, setNewUpiAccount, 'upiAccounts')}
        {renderSection('Vehicles', vehicles, setVehicles, newVehicle, setNewVehicle, 'vehicles')}
      </div>
    </div>
  );
}
