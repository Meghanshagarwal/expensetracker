import { NextResponse } from 'next/server';

// Cache the live list for 30 min so we don't hammer NSE on every page load.
export const revalidate = 1800;

// Fallback list used when the live source is unreachable (e.g. NSE blocks the
// server IP). Keeps the IPO dropdown working no matter what.
const FALLBACK_IPOS = [
  { name: 'Tata Technologies', amount: 15000, source: 'static' },
  { name: 'NSE (National Stock Exchange)', amount: 14985, source: 'static' },
  { name: 'Swiggy', amount: 14820, source: 'static' },
  { name: 'Hyundai Motor India', amount: 14970, source: 'static' },
  { name: 'Ola Electric', amount: 14820, source: 'static' },
  { name: 'Bajaj Housing Finance', amount: 14980, source: 'static' },
  { name: 'Waaree Energies', amount: 14850, source: 'static' },
  { name: 'LIC of India', amount: 14805, source: 'static' },
  { name: 'Zomato', amount: 14820, source: 'static' },
];

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

async function fetchNseIpos(status: 'active' | 'upcoming') {
  const category = status === 'active' ? 'ipo' : 'ipo';
  // NSE requires a cookie handshake — hit the homepage first.
  const home = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  const cookie = home.headers.get('set-cookie') || '';

  const url =
    status === 'active'
      ? `https://www.nseindia.com/api/all-upcoming-issues?category=${category}`
      : `https://www.nseindia.com/api/all-upcoming-issues?category=${category}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo',
      Cookie: cookie,
    },
  });
  if (!res.ok) throw new Error(`NSE ${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    const raw = await fetchNseIpos('active');
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ source: 'static', ipos: FALLBACK_IPOS });
    }

    const ipos = raw
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
          symbol: i.symbol || '',
          source: 'live',
        };
      });

    // Merge live IPOs first, then a few well-known fallbacks (deduped by name).
    const seen = new Set(ipos.map((i: any) => i.name.toLowerCase()));
    const merged = [...ipos, ...FALLBACK_IPOS.filter(f => !seen.has(f.name.toLowerCase()))];

    return NextResponse.json({ source: 'live', ipos: merged });
  } catch (err: any) {
    // Live source failed — serve the static list so the app never breaks.
    return NextResponse.json({ source: 'static', ipos: FALLBACK_IPOS, error: err.message });
  }
}
