import { NextResponse } from 'next/server';

const JAIPUR_PETROL_URL = 'https://www.goodreturns.in/petrol-price-in-jaipur.html';
const DEFAULT_PRICE = 113.15; // Baseline default price for Jaipur

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const targetDate = new Date(dateParam);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    targetDate.setHours(0, 0, 0, 0);
    const targetTime = targetDate.getTime();

    // Fetch the GoodReturns page with standard headers
    let html = '';
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout
      
      const res = await fetch(JAIPUR_PETROL_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        next: { revalidate: 3600 } // Cache for 1 hour
      });
      clearTimeout(id);
      
      if (res.ok) {
        html = await res.text();
      }
    } catch (fetchErr) {
      console.error('Failed to fetch petrol page, using default/fallback:', fetchErr);
    }

    if (!html) {
      // Offline or fetch failed, return default
      return NextResponse.json({ price: DEFAULT_PRICE, source: 'fallback' });
    }

    // Match <tr> followed by Date td, followed by Price td (starts with &#x20b9; or ₹)
    const rowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>(?:&#x20b9;|₹)([\d.]+)<\/td>/gi;
    
    let match;
    const history: { time: number; price: number; dateStr: string }[] = [];

    while ((match = rowRegex.exec(html)) !== null) {
      const dateStr = match[1].trim();
      const priceVal = parseFloat(match[2]);
      
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          history.push({
            time: d.getTime(),
            price: priceVal,
            dateStr,
          });
        }
      } catch (e) {
        // Ignore parsing errors for individual rows
      }
    }

    if (history.length === 0) {
      // Regex failed to match or page structure changed, return default
      return NextResponse.json({ price: DEFAULT_PRICE, source: 'fallback-no-match' });
    }

    // Sort history by time ascending
    history.sort((a, b) => a.time - b.time);

    // Look for exact match
    const exactMatch = history.find(h => h.time === targetTime);
    if (exactMatch) {
      return NextResponse.json({ price: exactMatch.price, date: exactMatch.dateStr, source: 'scraped-exact' });
    }

    // No exact match. Determine if requested date is newer than latest scraped, or older than oldest
    const oldest = history[0];
    const newest = history[history.length - 1];

    if (targetTime > newest.time) {
      // Target date is in the future relative to our scraper history (e.g. today but table hasn't updated yet)
      return NextResponse.json({ price: newest.price, date: newest.dateStr, source: 'scraped-latest' });
    }

    if (targetTime < oldest.time) {
      // Target date is older than the 10-day history window
      return NextResponse.json({ price: oldest.price, date: oldest.dateStr, source: 'scraped-oldest' });
    }

    // It falls in a gap between scraped dates. Let's find the closest date
    let closest = history[0];
    let minDiff = Math.abs(targetTime - closest.time);

    for (const item of history) {
      const diff = Math.abs(targetTime - item.time);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }

    return NextResponse.json({ price: closest.price, date: closest.dateStr, source: 'scraped-closest' });
  } catch (error: any) {
    return NextResponse.json({ price: DEFAULT_PRICE, error: error.message, source: 'error-fallback' });
  }
}
