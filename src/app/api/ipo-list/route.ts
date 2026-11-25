import { NextResponse } from 'next/server';
import { findIpoSchedule, indiaDate, ipoDate, ipoNameKey, type IpoSchedule } from '@/lib/ipoDates';

// Cache the live list for 30 min so we don't hammer NSE on every page load.
export const revalidate = 1800;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Parse the upper value out of a "Rs.161 to Rs.170" price-band string.
function upperPrice(band: string): number | null {
  const nums = (band.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return null;
  return Math.max(...nums);
}

// SEBI keeps the minimum retail application (1 lot) just under ~₹15,000.
// We don't get lot size from this endpoint, so estimate: lot = round(14500/price).
function estimateAmount(band: string): number {
  const price = upperPrice(band);
  if (!price || price <= 0) return 15000;
  const lot = Math.max(1, Math.round(14500 / price));
  return Math.round(lot * price);
}

async function nseCookie(): Promise<string> {
  const home = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(5000),
  });
  return home.headers.get('set-cookie') || '';
}

async function fetchCategory(category: 'ipo' | 'sme', cookie: string) {
  const res = await fetch(`https://www.nseindia.com/api/all-upcoming-issues?category=${category}`, {
    signal: AbortSignal.timeout(5000),
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo',
      Cookie: cookie,
    },
  });
  if (!res.ok) throw new Error(`NSE ${category} ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchGmpHtml(): Promise<string> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // 6s timeout
    const res = await fetch('https://ipowatch.in/ipo-gmp-grey-market-premium/', {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html',
      },
      signal: controller.signal,
      next: { revalidate: 1800 } // Cache for 30 min
    });
    clearTimeout(id);
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {
    console.error('Failed to fetch GMP HTML:', e);
  }
  return '';
}

function parseGmp(html: string): Map<string, { gmp: number; direction: 'up' | 'down' }> {
  const gmpMap = new Map<string, { gmp: number; direction: 'up' | 'down' }>();
  if (!html) return gmpMap;

  const match = html.match(/<div class="gmp-ticker-list">([\s\S]*?)<\/div>/i);
  if (match) {
    const links = match[1].match(/<a[^>]*>([\s\S]*?)<\/a>/gi) || [];
    links.forEach(l => {
      const text = l.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#038;/g, '&').trim();
      const upDownMatch = text.match(/([\s\S]+?)(▲|▼)\s*(\+|-)?₹?([\d.,]+)/i);
      if (upDownMatch) {
        const name = upDownMatch[1].trim();
        const direction = upDownMatch[2] === '▲' ? 'up' : 'down';
        const value = parseFloat(upDownMatch[4].replace(/,/g, ''));
        gmpMap.set(name.toLowerCase(), { gmp: value, direction });
      }
    });
  }
  return gmpMap;
}

type CalendarPreset = IpoSchedule & {
  openDate: string;
  board: string;
  source: 'live';
  amount: number;
  priceBand: string;
};

async function fetchCalendar() {
  const [year, month] = indiaDate().split('-').map(Number);
  const months = [-1, 0, 1].map(offset => new Date(Date.UTC(year, month - 1 + offset, 1)));
  const results = await Promise.allSettled(months.map(async date => {
    const url = `https://ipowatch.in/server/api/ipo/GetAllIpoListing/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`IPO calendar returned ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.result) ? data.result : [];
  }));
  const schedules = new Map<string, IpoSchedule>();
  const presets = new Map<string, CalendarPreset>();
  const today = indiaDate();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item || typeof item.name !== 'string') continue;
      const allotmentDate = ipoDate(item.allotmentDate);
      const listingDate = ipoDate(item.listingDate);
      const closeDate = ipoDate(item.closeDate);
      const key = `${ipoNameKey(item.name)}:${closeDate ?? ''}`;
      const previous = schedules.get(key);
      const schedule = {
        name: item.name,
        closeDate,
        allotmentDate: allotmentDate ?? previous?.allotmentDate,
        listingDate: listingDate ?? previous?.listingDate,
      };
      if (allotmentDate || listingDate) schedules.set(key, schedule);
      const openDate = ipoDate(item.openDate);
      if (!openDate || !closeDate || closeDate < today) continue;
      const price = Number(item.priceBandTo);
      const lowerPrice = Number(item.priceBandFrom);
      const lotSize = Number(item.ipoMinBidQty || item.lotSize);
      const priceBand = price > 0 ? (lowerPrice > 0 && lowerPrice < price ? `₹${lowerPrice}–₹${price}` : `₹${price}`) : '';
      presets.set(key, {
        ...schedule,
        openDate,
        board: item.type === 'Mainboard' ? 'Mainboard' : 'SME',
        source: 'live',
        amount: price > 0 && lotSize > 0 ? price * lotSize : 0,
        priceBand,
      });
    }
  }
  return { schedules: [...schedules.values()], presets: [...presets.values()] };
}

export async function GET() {
  try {
    const nse = nseCookie().then(cookie => Promise.all([
      fetchCategory('ipo', cookie).catch(() => []),
      fetchCategory('sme', cookie).catch(() => []),
    ])).catch(() => [[], []]);
    const [[main, sme], gmpHtml, { schedules, presets }] = await Promise.all([
      nse,
      fetchGmpHtml(),
      fetchCalendar(),
    ]);

    const gmpMap = parseGmp(gmpHtml);
    const getGmpForCompany = (companyName: string) => {
      const normCompany = ipoNameKey(companyName);
      for (const [gmpName, data] of gmpMap.entries()) {
        const normGmp = ipoNameKey(gmpName.replace(/\s+sme$/i, ''));
        if (normCompany.includes(normGmp) || normGmp.includes(normCompany)) {
          return data;
        }
      }
      return null;
    };

    const map = (rows: any[], board: string) =>
      rows
        .filter((i: any) => i.companyName)
        .map((i: any) => {
          const band = i.issuePrice || '';
          const name = String(i.companyName).replace(/\s+Limited$/i, '').trim();
          const gmpInfo = getGmpForCompany(name);
          const schedule = findIpoSchedule(schedules, name, i.issueEndDate);

          return {
            name,
            amount: estimateAmount(band),
            priceBand: band,
            openDate: i.issueStartDate || '',
            closeDate: i.issueEndDate || '',
            allotmentDate: schedule?.allotmentDate,
            listingDate: schedule?.listingDate,
            status: i.status || '',
            board,
            symbol: i.symbol || '',
            source: 'live',
            gmp: gmpInfo ? gmpInfo.gmp : undefined,
            gmpDirection: gmpInfo ? gmpInfo.direction : undefined,
          };
        });

    const nseIpos = [...map(main, 'Mainboard'), ...map(sme, 'SME')];
    const names = new Set(nseIpos.map(ipo => ipoNameKey(ipo.name)));
    const ipos = [...nseIpos, ...presets.filter(ipo => !names.has(ipoNameKey(ipo.name)))];

    return NextResponse.json({ source: ipos.length ? 'live' : 'empty', ipos, schedules });
  } catch (err: any) {
    // Live source unreachable — return empty so the UI shows no misleading names.
    return NextResponse.json({ source: 'unavailable', ipos: [], error: err.message });
  }
}
