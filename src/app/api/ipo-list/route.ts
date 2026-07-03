import { NextResponse } from 'next/server';

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
  });
  return home.headers.get('set-cookie') || '';
}

async function fetchCategory(category: 'ipo' | 'sme', cookie: string) {
  const res = await fetch(`https://www.nseindia.com/api/all-upcoming-issues?category=${category}`, {
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

export async function GET() {
  try {
    const cookie = await nseCookie();
    // Pull both mainboard IPOs and SME issues that are open / upcoming on NSE.
    const [main, sme] = await Promise.all([
      fetchCategory('ipo', cookie).catch(() => []),
      fetchCategory('sme', cookie).catch(() => []),
    ]);

    const map = (rows: any[], board: string) =>
      rows
        .filter((i: any) => i.companyName)
        .map((i: any) => {
          const band = i.issuePrice || '';
          return {
            name: String(i.companyName).replace(/\s+Limited$/i, '').trim(),
            amount: estimateAmount(band),
            priceBand: band,
            openDate: i.issueStartDate || '',
            closeDate: i.issueEndDate || '',
            status: i.status || '',
            board,
            symbol: i.symbol || '',
            source: 'live',
          };
        });

    const ipos = [...map(main, 'Mainboard'), ...map(sme, 'SME')];

    return NextResponse.json({ source: ipos.length ? 'live' : 'empty', ipos });
  } catch (err: any) {
    // Live source unreachable — return empty so the UI shows no misleading names.
    return NextResponse.json({ source: 'unavailable', ipos: [], error: err.message });
  }
}
