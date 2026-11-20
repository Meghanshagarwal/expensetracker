'use client';

import { useId, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import type { Expense } from '@/types';

const periods = ['Week', 'Month', 'Year'] as const;
type Period = typeof periods[number];
const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

function getSeries(expenses: Expense[], now: Date, period: Period) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'Week') start.setDate(start.getDate() - 6);
  if (period === 'Month') start.setDate(1);
  if (period === 'Year') start.setMonth(0, 1);

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const points = [];
  for (const date = new Date(start); date < end;) {
    points.push({ date: new Date(date), spend: 0, total: 0 });
    if (period === 'Year') date.setMonth(date.getMonth() + 1);
    else date.setDate(date.getDate() + 1);
  }
  const key = (date: Date) => period === 'Year' ? date.getMonth() : date.toDateString();
  const buckets = new Map(points.map(point => [key(point.date), point]));
  for (const expense of expenses) {
    if (expense.transactionType && expense.transactionType !== 'expense') continue;
    const date = new Date(expense.date);
    if (date >= start && date < end) {
      const bucket = buckets.get(key(date));
      if (bucket) bucket.spend += expense.amount;
    }
  }
  let total = 0;
  for (const point of points) {
    total += point.spend;
    point.total = total;
  }
  return points;
}

export default function SpendingOverview({ expenses, now }: { expenses: Expense[]; now: Date | null }) {
  const [period, setPeriod] = useState<Period>('Month');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const series = useMemo(() => now ? getSeries(expenses, now, period) : [], [expenses, now, period]);
  const fillId = useId();
  const titleId = useId();
  const total = series.at(-1)?.total ?? 0;
  const peak = Math.max(total, 1);
  const pointX = (index: number) => series.length <= 1 ? 99 : 1 + (index * 98) / (series.length - 1);
  const pointY = (amount: number) => 94 - (amount / peak) * 81;
  const line = series.map((point, i) => `${pointX(i)},${pointY(point.total)}`).join(' ');
  const labelDate = (date: Date) => date.toLocaleDateString('en-GB', period === 'Year'
    ? { month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
  const selectedIndex = Math.max(0, Math.min(hoverIndex ?? series.length - 1, series.length - 1));
  const point = series[selectedIndex];
  const amount = point?.total ?? 0;
  const first = series[0];
  const last = series.at(-1);
  const descriptor = { Week: 'Last 7 days', Month: 'Month to date', Year: 'Year to date' }[period];

  return (
    <section className="ft-spending" aria-labelledby={titleId}>
      <div className="ft-contours" aria-hidden="true" />
      <div className="ft-spend-top">
        <h2 id={titleId}><Activity size={17} aria-hidden="true" /> Total spending</h2>
        <div className="ft-period" role="group" aria-label="Spending period">
          {periods.map(option => <button key={option} type="button" aria-pressed={period === option}
            onClick={() => { setPeriod(option); setHoverIndex(null); }}>{option}</button>)}
        </div>
      </div>
      <div className="ft-total" aria-live="polite">{now ? rupees.format(total) : '—'}</div>
      <div className="ft-range">{descriptor}</div>
      <div className="ft-chart" role="group" aria-label="Cumulative spending chart">
        <div className="ft-gridlines" aria-hidden="true" />
        {point && <>
          <svg key={period} aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="#39724b" stopOpacity=".33" />
              <stop offset="100%" stopColor="#39724b" stopOpacity=".02" />
            </linearGradient></defs>
            <polygon points={`1,100 ${line} 99,100`} fill={`url(#${fillId})`} />
            <polyline className="ft-plot-line" points={line} pathLength="1" />
          </svg>
          <div className="ft-dot" aria-hidden="true" style={{ left: `${pointX(selectedIndex)}%`, top: `${pointY(amount)}%` }} />
          {hoverIndex !== null && <output className="ft-point-value">{labelDate(point.date)} · {rupees.format(amount)}</output>}
          <input className="ft-chart-input" type="range" min="0" max={Math.max(0, series.length - 1)}
            value={selectedIndex} aria-label="Inspect cumulative spend by date"
            aria-valuetext={`${labelDate(point.date)}, ${rupees.format(amount)}`}
            onFocus={() => setHoverIndex(selectedIndex)} onBlur={() => setHoverIndex(null)}
            onChange={event => setHoverIndex(Number(event.target.value))}
            onPointerMove={event => {
              if (event.pointerType !== 'mouse') return;
              const rect = event.currentTarget.getBoundingClientRect();
              setHoverIndex(Math.round((event.clientX - rect.left) / rect.width * (series.length - 1)));
            }}
            onPointerLeave={event => { if (event.pointerType === 'mouse') setHoverIndex(null); }} />
        </>}
      </div>
      <div className="ft-chart-axis">
        <span>{first ? labelDate(first.date) : '—'}</span>
        <span className="ft-chart-key"><i /> Cumulative spend</span>
        <span>{last ? labelDate(last.date) : '—'}</span>
      </div>
    </section>
  );
}

