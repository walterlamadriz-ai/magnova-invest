// api/history.js — Vercel Edge Function
// Yahoo Finance historical data — for charts and comparator
// Usage: /api/history?ticker=AAPL&range=3mo&interval=1d

export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const ticker   = (searchParams.get('ticker') || '').toUpperCase();
  const range    = searchParams.get('range')    || '3mo';
  const interval = searchParams.get('interval') || '1d';

  if (!ticker) {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: HEADERS });
  }

  // Validate range and interval to prevent abuse
  const validRanges    = ['1d','5d','1mo','3mo','6mo','1y','2y','5y'];
  const validIntervals = ['1m','5m','15m','1h','1d','1wk','1mo'];
  if (!validRanges.includes(range) || !validIntervals.includes(interval)) {
    return new Response(JSON.stringify({ error: 'invalid range or interval' }), { status: 400, headers: HEADERS });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FINANCEOS/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Yahoo returned ${res.status}` }), { status: 502, headers: HEADERS });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: 'no data' }), { status: 404, headers: HEADERS });
    }

    const timestamps = result.timestamp || result.timestamps || [];
    const quotes     = result.indicators?.quote?.[0] || {};
    const closes     = quotes.close  || [];
    const opens      = quotes.open   || [];
    const highs      = quotes.high   || [];
    const lows       = quotes.low    || [];
    const volumes    = quotes.volume || [];

    const data = timestamps
      .map((t, i) => ({
        date:   new Date(t * 1000).toISOString().split('T')[0],
        open:   opens[i]   || closes[i] || 0,
        high:   highs[i]   || closes[i] || 0,
        low:    lows[i]    || closes[i] || 0,
        close:  closes[i]  || 0,
        volume: volumes[i] || 0,
      }))
      .filter(d => d.close > 0);

    return new Response(JSON.stringify({ ticker, range, interval, data }), { status: 200, headers: HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
