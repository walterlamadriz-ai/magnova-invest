// api/fundamentals.js — Vercel Edge Function
// Fundamentals (PE, EPS, Beta) — supplementary data for asset drawer
// Usage: /api/fundamentals?ticker=AAPL
//
// KNOWN RISK: this data lives on Yahoo's v7/finance/quote and quoteSummary
// endpoints, which have historically required a crumb/cookie and have been
// progressively locked down since 2023-2024 (same root cause as marketCap=0
// in api/quote.js). This function degrades gracefully: any field that can't
// be fetched returns null, and the client should render "—" for null fields
// rather than 0 (0 would be misleading — e.g. PE of 0 reads as "free").

export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const tickersParam = (searchParams.get('ticker') || '').toUpperCase();

  if (!tickersParam) {
    return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: HEADERS });
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);

  try {
    const results = await Promise.allSettled(tickers.map(fetchFundamentals));

    const data = {};
    const errors = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        data[tickers[i]] = result.value;
      } else {
        errors[tickers[i]] = 'fundamentals_unavailable';
      }
    });

    if (Object.keys(data).length === 0) {
      return new Response(JSON.stringify({ error: 'no_data', details: errors }), { status: 404, headers: HEADERS });
    }

    if (Object.keys(errors).length > 0) {
      data._errors = errors;
    }

    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: String(err) }), { status: 500, headers: HEADERS });
  }
}

async function fetchFundamentals(ticker) {
  // Primary attempt: v7/finance/quote — single lightweight call, has PE/EPS/Beta
  // directly on the result object if it succeeds.
  const v7 = await tryV7Quote(ticker);
  if (v7) return v7;

  // Fallback: quoteSummary with defaultKeyStatistics + summaryDetail modules.
  // Heavier endpoint, historically more locked down — last resort.
  const summary = await tryQuoteSummary(ticker);
  if (summary) return summary;

  // Both failed — return all-null shape so the client can render "—"
  // for every field without special-casing a missing ticker.
  return {
    ticker,
    pe: null,
    eps: null,
    beta: null,
    forwardPE: null,
    dividendYield: null,
    fetchedAt: Date.now(),
    source: 'unavailable',
  };
}

async function tryV7Quote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceOSInvest/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const r = json?.quoteResponse?.result?.[0];
    if (!r) return null;

    return {
      ticker,
      pe:            numOrNull(r.trailingPE),
      eps:           numOrNull(r.epsTrailingTwelveMonths),
      beta:          numOrNull(r.beta),
      forwardPE:     numOrNull(r.forwardPE),
      dividendYield: numOrNull(r.dividendYield ? r.dividendYield * 100 : null), // as %
      fetchedAt:     Date.now(),
      source:        'v7',
    };
  } catch (e) {
    return null;
  }
}

async function tryQuoteSummary(ticker) {
  try {
    const modules = 'defaultKeyStatistics,summaryDetail';
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceOSInvest/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const stats = result.defaultKeyStatistics || {};
    const summary = result.summaryDetail || {};

    return {
      ticker,
      pe:            numOrNull(summary.trailingPE?.raw),
      eps:           numOrNull(stats.trailingEps?.raw),
      beta:          numOrNull(stats.beta?.raw),
      forwardPE:     numOrNull(stats.forwardPE?.raw),
      dividendYield: numOrNull(summary.dividendYield?.raw ? summary.dividendYield.raw * 100 : null),
      fetchedAt:     Date.now(),
      source:        'quoteSummary',
    };
  } catch (e) {
    return null;
  }
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
