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
    const errors = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        data[tickers[i]] = result.value;
      } else {
        errors[tickers[i]] = 'ticker_not_found';
      }
    });

    if (Object.keys(data).length === 0) {
      return new Response(JSON.stringify({ error: 'no_valid_tickers', details: errors }), { status: 404, headers: HEADERS });
    }

    if (Object.keys(errors).length > 0) {
      data._errors = errors; // partial-success info for batch requests
    }

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
  // FIX: meta.previousClose is undefined on the /v8/finance/chart endpoint —
  // the correct field there is chartPreviousClose. Fallback chain preserved
  // for safety in case Yahoo's schema changes again.
  const prev  = meta.chartPreviousClose || meta.previousClose || price;

  // FIX: marketCap is not present on /v8/finance/chart at all — fetch it
  // separately from /v7/finance/quote, which also has been historically
  // less reliable (may be blocked/require auth). Degrade gracefully to 0
  // if this second call fails, without breaking the rest of the response.
  let marketCap = 0;
  try {
    marketCap = await fetchMarketCap(ticker);
  } catch (e) {
    // swallow — marketCap stays 0, rest of the quote is unaffected
  }

  return {
    ticker,
    price,
    prevClose:  prev,
    change:     price - prev,
    changePct:  prev ? (price - prev) / prev : 0,
    volume:     meta.regularMarketVolume || 0,
    high52:     meta.fiftyTwoWeekHigh    || 0,
    low52:      meta.fiftyTwoWeekLow     || 0,
    marketCap:  marketCap,
    currency:   meta.currency            || 'USD',
    fetchedAt:  Date.now(),
  };
}

async function fetchMarketCap(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MAGNOVA/1.0)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) return 0;

  const json = await res.json();
  const result = json?.quoteResponse?.result?.[0];
  return result?.marketCap || 0;
}
