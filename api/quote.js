// api/quote.js — Vercel Edge Function
// Yahoo Finance proxy — runs server-side, no CORS issues, no external proxy
// Usage: /api/quote?ticker=AAPL
//        /api/quote?ticker=AAPL,MSFT,NVDA  (batch, max 10)

export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const tickerParam = searchParams.get('ticker') || '';
  const tickers = tickerParam.toUpperCase().split(',').filter(Boolean).slice(0, 10);

  if (!tickers.length) {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: HEADERS });
  }

  try {
    // Fetch all tickers in parallel from Yahoo Finance
    const results = await Promise.allSettled(
      tickers.map(ticker => fetchYahooQuote(ticker))
    );

    const data = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        data[tickers[i]] = result.value;
      }
    });

    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}

async function fetchYahooQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MAGNOVA/1.0)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;

  const price = meta.regularMarketPrice;
  const prev  = meta.previousClose || price;

  return {
    ticker,
    price,
    prevClose:  prev,
    change:     price - prev,
    changePct:  prev ? (price - prev) / prev : 0,
    volume:     meta.regularMarketVolume || 0,
    high52:     meta.fiftyTwoWeekHigh    || 0,
    low52:      meta.fiftyTwoWeekLow     || 0,
    marketCap:  meta.marketCap           || 0,
    currency:   meta.currency            || 'USD',
    fetchedAt:  Date.now(),
  };
}
