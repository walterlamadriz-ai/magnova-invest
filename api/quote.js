// api/quote.js — Vercel Edge Function
// Yahoo Finance proxy — runs server-side, no CORS issues, no external proxy
// Usage: /api/quote?ticker=AAPL
//        /api/quote?ticker=AAPL,MSFT,NVDA  (batch, max 10)
// marketCap intentionally omitted — provided by /api/fundamentals (FMP) to avoid
// a second sequential HTTP call that added 1-4s to every price response.

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com', 'https://app.financeospro.com'];

function getCors(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    'Vary': 'Origin',
  };
}

export default async function handler(req) {
  const HEADERS = getCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  // Basic ticker validation — alphanumeric + allowed symbols only
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('ticker') || '';
  const invalid = raw.split(',').some(t => !/^[\^A-Z0-9.\-=]{1,15}$/i.test(t.trim()));
  if (invalid) return new Response(JSON.stringify({ error: 'invalid_ticker' }), { status: 400, headers: HEADERS });

  const tickers = raw.toUpperCase().split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
  if (!tickers.length) {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: HEADERS });
  }

  try {
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
      data._errors = errors;
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
      'User-Agent': 'Mozilla/5.0 (compatible; FINANCEOS/1.0)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;

  const price = meta.regularMarketPrice;
  const prev  = meta.chartPreviousClose || meta.previousClose || price;

  return {
    ticker,
    price,
    prevClose:  prev,
    change:     price - prev,
    changePct:  prev ? (price - prev) / prev : 0,
    volume:     meta.regularMarketVolume || 0,
    high52:     meta.fiftyTwoWeekHigh    || 0,
    low52:      meta.fiftyTwoWeekLow     || 0,
    marketCap:  0, // provided by /api/fundamentals when drawer opens
    currency:   meta.currency            || 'USD',
    fetchedAt:  Date.now(),
  };
}
