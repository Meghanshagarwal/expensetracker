import type { Ipo } from '@/types';
import { indiaDate } from '@/lib/ipoDates';

function dayFromToday(days: number) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + days);
  return indiaDate(day);
}

export function ipoDemo() {
  const base = {
    lots: 1,
    amount: 14800,
    appliedFrom: 'Me',
    applyDate: dayFromToday(-14),
    closeDate: dayFromToday(-10),
    createdAt: dayFromToday(-14),
    contributions: [],
    returnAmount: 0,
    profitAmount: 0,
  };
  const entries: Ipo[] = [
    { ...base, _id: 'demo-applied', ipoName: 'Northstar Mobility', status: 'Applied',
      applyDate: dayFromToday(-1), closeDate: dayFromToday(0), allotmentDate: dayFromToday(2), listingDate: dayFromToday(4) },
    { ...base, _id: 'demo-ready', ipoName: 'Aster Diagnostics', status: 'Applied',
      allotmentDate: dayFromToday(0), listingDate: dayFromToday(2) },
    { ...base, _id: 'demo-allotted', ipoName: 'Juniper Energy', status: 'Allotted',
      allotmentDate: dayFromToday(-2), listingDate: dayFromToday(1) },
    { ...base, _id: 'demo-refunded', ipoName: 'Harbor Robotics', status: 'Not Allotted',
      appliedFrom: 'Mummy', allotmentDate: dayFromToday(-7), returnDate: dayFromToday(-6),
      contributions: [{ from: 'My Salaried Account', amount: base.amount, date: base.applyDate }],
      returnAmount: base.amount },
  ];
  const preset = {
    name: 'Cedar Grid',
    amount: 14950,
    openDate: dayFromToday(-4),
    closeDate: dayFromToday(-1),
    allotmentDate: dayFromToday(0),
    listingDate: dayFromToday(2),
  };
  return { entries, preset };
}
