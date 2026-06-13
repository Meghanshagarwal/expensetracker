'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line
} from 'recharts';
import { getLocalExpenses, getLocalPersons } from '@/lib/offlineDb';
import { Expense, Person } from '@/types';
import { BarChart3 } from 'lucide-react';

const LUX_COLORS = ['#F5C451', '#FFFFFF', '#8A8A8A', '#555555', '#2A2A2A', '#1F1F1F', '#4ADE80', '#FF5A5F'];

export default function AnalyticsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const exp = await getLocalExpenses();
      const per = await getLocalPersons();
      setExpenses(exp);
      setPersons(per);
      setMounted(true);
    };
    loadData();
  }, []);

  const personMap = useMemo(() => new Map(persons.map(p => [p._id, p.name])), [persons]);

  const dailyTrendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const spendMap = new Map<string, number>();
    last30Days.forEach(day => spendMap.set(day, 0));

    expenses.forEach(exp => {
      if ((exp.transactionType || 'expense') !== 'expense') return;
      const day = exp.date.split('T')[0];
      if (spendMap.has(day)) {
        spendMap.set(day, spendMap.get(day)! + exp.amount);
      }
    });

    return last30Days.map(day => {
      const dateObj = new Date(day);
      return {
        name: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        Amount: spendMap.get(day) || 0,
      };
    });
  }, [expenses]);

  const categoryData = useMemo(() => {
    const catMap = new Map<string, number>();
    expenses.forEach(exp => {
      if ((exp.transactionType || 'expense') !== 'expense') return;
      catMap.set(exp.category, (catMap.get(exp.category) || 0) + exp.amount);
    });

    return Array.from(catMap.entries()).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const personData = useMemo(() => {
    const spendMap = new Map<string, number>();
    expenses.forEach(exp => {
      if ((exp.transactionType || 'expense') !== 'expense') return;
      const name = personMap.get(exp.personId) || 'Unknown';
      spendMap.set(name, (spendMap.get(name) || 0) + exp.amount);
    });

    return Array.from(spendMap.entries()).map(([name, amount]) => ({
      name,
      amount,
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, personMap]);

  const paymentData = useMemo(() => {
    const methodMap = new Map<string, number>();
    expenses.forEach(exp => {
      if ((exp.transactionType || 'expense') !== 'expense') return;
      methodMap.set(exp.paymentMethod, (methodMap.get(exp.paymentMethod) || 0) + exp.amount);
    });

    return Array.from(methodMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [expenses]);

  const last12MonthsData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trend: { name: string; amount: number; year: number; monthIdx: number }[] = [];

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        name: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
        amount: 0,
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
      });
    }

    expenses.forEach(exp => {
      if ((exp.transactionType || 'expense') !== 'expense') return;
      const expDate = new Date(exp.date);
      const expYear = expDate.getFullYear();
      const expMonth = expDate.getMonth();

      const matchingBucket = trend.find(
        bucket => bucket.year === expYear && bucket.monthIdx === expMonth
      );
      if (matchingBucket) {
        matchingBucket.amount += exp.amount;
      }
    });

    return trend.map(bucket => ({
      name: bucket.name,
      Amount: bucket.amount,
    }));
  }, [expenses]);

  if (!mounted) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
      </div>
    );
  }

  const totalSpend = expenses.filter(e => (e.transactionType || 'expense') === 'expense').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8 text-white pb-12">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-gold-400" />
        </div>
        <div>
          <h1 className="text-xl font-light tracking-tight">Financial Analytics</h1>
          <p className="text-xs text-[#8A8A8A] font-light">Visual breakdown of your personal spending habits</p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-10 text-center text-[#555555] text-sm font-light">
          No expenses recorded. Add expenses on the dashboard to view chart statistics.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-luxury">
            <h2 className="text-[10px] font-normal tracking-luxury-wide uppercase text-[#8A8A8A]">Last 12 Months Trend</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last12MonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="#555555" fontSize={11} tickLine={false} />
                  <YAxis stroke="#555555" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                    itemStyle={{ color: '#F5C451' }}
                    labelStyle={{ color: '#fff', fontWeight: 'normal' }}
                    formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Spend']}
                  />
                  <Line type="monotone" dataKey="Amount" stroke="#F5C451" strokeWidth={2.5} dot={{ r: 3, stroke: '#F5C451', strokeWidth: 1.5, fill: '#111111' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-luxury">
              <h2 className="text-[10px] font-normal tracking-luxury-wide uppercase text-[#8A8A8A]">Last 30 Days (Daily)</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F5C451" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#F5C451" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#555555" fontSize={10} tickLine={false} />
                    <YAxis stroke="#555555" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                      itemStyle={{ color: '#F5C451' }}
                      labelStyle={{ color: '#fff', fontWeight: 'normal' }}
                      formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Spend']}
                    />
                    <Area type="monotone" dataKey="Amount" stroke="#F5C451" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between shadow-luxury">
              <h2 className="text-[10px] font-normal tracking-luxury-wide uppercase text-[#8A8A8A] mb-4">Category Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-56 w-full flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={LUX_COLORS[index % LUX_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                        formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Spend']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                  {categoryData.map((entry, index) => {
                    const percentage = totalSpend > 0 ? ((entry.value / totalSpend) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LUX_COLORS[index % LUX_COLORS.length] }} />
                          <span className="font-light text-[#8A8A8A]">{entry.name}</span>
                        </div>
                        <div className="font-medium text-white text-[11px]">
                          ₹{entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-[9px] text-[#555555] font-light">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-luxury">
              <h2 className="text-[10px] font-normal tracking-luxury-wide uppercase text-[#8A8A8A]">Spending By Person</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={personData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" stroke="#555555" fontSize={11} tickLine={false} />
                    <YAxis stroke="#555555" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                      itemStyle={{ color: '#F5C451' }}
                      labelStyle={{ color: '#fff', fontWeight: 'normal' }}
                      formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Spend']}
                    />
                    <Bar dataKey="amount" fill="#F5C451" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex flex-col justify-between shadow-luxury">
              <h2 className="text-[10px] font-normal tracking-luxury-wide uppercase text-[#8A8A8A] mb-4">Payment Method Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-56 w-full flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={LUX_COLORS[(index + 1) % LUX_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111111', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '16px' }}
                        formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Spend']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2.5">
                  {paymentData.map((entry, index) => {
                    const percentage = totalSpend > 0 ? ((entry.value / totalSpend) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LUX_COLORS[(index + 1) % LUX_COLORS.length] }} />
                          <span className="font-light text-[#8A8A8A]">{entry.name}</span>
                        </div>
                        <div className="font-medium text-white text-[11px]">
                          ₹{entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-[9px] text-[#555555] font-light">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
