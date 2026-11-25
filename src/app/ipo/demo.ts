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
      allotmentDate: dayFromToday(0), listingDate: dayFromToday(2),
      contributions: [
        { from: 'Mummy', amount: 5000, date: base.applyDate },
        { from: 'Papa', amount: 9800, date: base.applyDate },
      ] },
    { ...base, _id: 'demo-allotted', ipoName: 'Juniper Energy', status: 'Allotted',
      allotmentDate: dayFromToday(-4), listingDate: dayFromToday(-2),
      withdrawnAmount: 17150, profitAmount: 2350,
      contributions: [
        { from: 'Mummy', amount: 5000, date: base.applyDate, returnAmount: 4000, returnDate: dayFromToday(0) },
        { from: 'Papa', amount: 6000, date: base.applyDate },
        { from: 'Anshshikha', amount: 3800, date: base.applyDate },
      ] },
    { ...base, _id: 'demo-refunded', ipoName: 'Harbor Robotics', status: 'Not Allotted',
      allotmentDate: dayFromToday(-7),
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
