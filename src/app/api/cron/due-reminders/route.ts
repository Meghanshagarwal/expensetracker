import { NextResponse } from 'next/server';
import dbConnect, { isMockMode, getMockData, saveMockData } from '@/lib/mongodb';
import Card from '@/models/Card';
import Expense from '@/models/Expense';
import PushSubscription from '@/models/PushSubscription';
import webpush, { isPushConfigured } from '@/lib/webpush';

// How many days before the due date we start reminding.
const REMIND_DAYS_BEFORE = 3;

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

// Whole days from today until the next occurrence of a given day-of-month.
function daysUntilDue(dueDay: number, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let y = today.getFullYear();
  let m = today.getMonth();
  let due = new Date(y, m, clampDay(y, m, dueDay));
  if (due < today) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    due = new Date(y, m, clampDay(y, m, dueDay));
  }
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function cardOutstanding(cardName: string, expenses: any[]) {
  const target = cardName.toLowerCase();
  return expenses
    .filter((exp) => {
      if (exp.isCardPaid) return false;
      const isCC = exp.paymentMethod === 'Credit Card';
      const isUPI = exp.paymentMethod === 'UPI';
      return (
        (isCC && exp.creditCardIssuer?.toLowerCase() === target) ||
        (isUPI &&
          (exp.upiLinkedAccount?.toLowerCase() === `${target} credit card` ||
            exp.upiLinkedAccount?.toLowerCase() === target))
      );
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

const formatRupee = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export async function GET(request: Request) {
  // Protect the endpoint when a CRON_SECRET is configured (Vercel Cron sends it).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isPushConfigured) {
    return NextResponse.json({ ok: false, reason: 'Push not configured (missing VAPID keys)' });
  }

  try {
    let cards: any[];
    let expenses: any[];
    let subscriptions: any[];

    if (isMockMode) {
      const data = getMockData();
      cards = data.cards || [];
      expenses = data.expenses || [];
      subscriptions = data.pushSubscriptions || [];
    } else {
      await dbConnect();
      [cards, expenses, subscriptions] = await Promise.all([
        Card.find({}).lean(),
        Expense.find({}).lean(),
        PushSubscription.find({}).lean(),
      ]);
    }

    // Find cards whose payment is due soon and still has an outstanding balance.
    const dueSoon = cards
      .filter((c) => c.dueDate)
      .map((c) => ({
        name: c.name,
        days: daysUntilDue(c.dueDate),
        outstanding: cardOutstanding(c.name, expenses),
      }))
      .filter((c) => c.outstanding > 0 && c.days <= REMIND_DAYS_BEFORE);

    if (dueSoon.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0, message: 'No cards due soon' });
    }

    const lines = dueSoon.map((c) => {
      const when = c.days === 0 ? 'due today' : c.days === 1 ? 'due tomorrow' : `due in ${c.days} days`;
      return `${c.name} ${formatRupee(c.outstanding)} ${when}`;
    });

    const payload = JSON.stringify({
      title: '💳 Credit Card Payment Due',
      body: lines.join('  •  '),
      url: '/cards',
    });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys } as any,
            payload,
          );
          sent += 1;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            stale.push(sub.endpoint);
          }
        }
      }),
    );

    // Clean up expired subscriptions.
    if (stale.length > 0) {
      if (isMockMode) {
        const data = getMockData();
        data.pushSubscriptions = (data.pushSubscriptions || []).filter((s: any) => !stale.includes(s.endpoint));
        saveMockData(data);
      } else {
        await PushSubscription.deleteMany({ endpoint: { $in: stale } });
      }
    }

    return NextResponse.json({ ok: true, reminded: dueSoon.length, sent, pruned: stale.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
