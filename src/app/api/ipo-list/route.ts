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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+limited$/i, '')
    .replace(/\s+ltd$/i, '')
    .replace(/\s+sme$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function GET() {
  try {
    const cookie = await nseCookie();
    // Pull both mainboard IPOs, SME issues from NSE, and live GMP data from IPO Watch
    const [main, sme, gmpHtml] = await Promise.all([
      fetchCategory('ipo', cookie).catch(() => []),
      fetchCategory('sme', cookie).catch(() => []),
      fetchGmpHtml().catch(() => ''),
    ]);

    const gmpMap = parseGmp(gmpHtml);
    const getGmpForCompany = (companyName: string) => {
      const normCompany = normalizeName(companyName);
      for (const [gmpName, data] of gmpMap.entries()) {
        const normGmp = normalizeName(gmpName);
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

          return {
            name,
            amount: estimateAmount(band),
            priceBand: band,
            openDate: i.issueStartDate || '',
            closeDate: i.issueEndDate || '',
            status: i.status || '',
            board,
            symbol: i.symbol || '',
            source: 'live',
            gmp: gmpInfo ? gmpInfo.gmp : undefined,
            gmpDirection: gmpInfo ? gmpInfo.direction : undefined,
          };
        });

    const ipos = [...map(main, 'Mainboard'), ...map(sme, 'SME')];

    return NextResponse.json({ source: ipos.length ? 'live' : 'empty', ipos });
  } catch (err: any) {
    // Live source unreachable — return empty so the UI shows no misleading names.
    return NextResponse.json({ source: 'unavailable', ipos: [], error: err.message });
  }
}
