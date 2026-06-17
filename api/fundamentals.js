// api/fundamentals.js — Vercel Edge Function
// Fundamentals via Financial Modeling Prep (FMP) API
// Reduced to 2 parallel calls (profile + ratios-ttm) — quote data comes from
// /api/quote (Yahoo) and key-metrics-ttm duplicates ratios-ttm on free tier.
export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const { searchParams } = new URL(req.url);
  const tickersParam = (searchParams.get('ticker') || '').toUpperCase().trim();
  if (!tickersParam) return new Response(JSON.stringify({ error: 'ticker_required' }), { status: 400, headers: HEADERS });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 503, headers: HEADERS });

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);

  try {
    const results = await Promise.allSettled(tickers.map(t => fetchFundamentals(t, apiKey)));
    const data = {}, errors = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) data[tickers[i]] = result.value;
      else errors[tickers[i]] = 'unavailable';
    });

    if (Object.keys(data).length === 0) {
      return new Response(JSON.stringify({ error: 'no_data', details: errors }), { status: 404, headers: HEADERS });
    }
    if (Object.keys(errors).length > 0) data._errors = errors;
    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: HEADERS });
  }
}

async function fetchFundamentals(ticker, apiKey) {
  // 2 calls instead of 4: profile has price+marketCap+beta+sector+description,
  // ratios-ttm has all valuation/profitability ratios. key-metrics-ttm overlaps
  // ratios-ttm on FMP free tier and /v3/quote duplicates Yahoo data we already have.
  const [profileRes, ratiosRes] = await Promise.allSettled([
    fmpFetch(`/v3/profile/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/ratios-ttm/${encodeURIComponent(ticker)}`, apiKey),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  const ratiosRaw = ratiosRes.status === 'fulfilled' ? ratiosRes.value : null;
  const ratios = Array.isArray(ratiosRaw) ? ratiosRaw[0] : ratiosRaw;

  if (!profile?.symbol) return null;

  const price   = numOrNull(profile.price);
  const lastDiv = numOrNull(profile.lastDividend || profile.lastDiv);

  return {
    ticker,
    // Valuation
    peRatio:       numOrNull(ratios?.peRatioTTM),
    forwardPE:     numOrNull(ratios?.priceEarningsRatioTTM),
    priceToBook:   numOrNull(ratios?.priceToBookRatioTTM),
    eps:           numOrNull(ratios?.epsTTM || profile.eps),
    // Profitability
    grossMargin:   numOrNull(ratios?.grossProfitMarginTTM),
    netMargin:     numOrNull(ratios?.netProfitMarginTTM),
    roe:           numOrNull(ratios?.returnOnEquityTTM),
    // Growth
    revenueGrowth: numOrNull(ratios?.revenueGrowthTTM),
    // Risk
    beta:          numOrNull(profile.beta),
    debtToEquity:  numOrNull(ratios?.debtEquityRatioTTM),
    // Dividend
    dividendYield: numOrNull(ratios?.dividendYieldTTM || (lastDiv && price ? lastDiv / price : null)),
    // Market data — profile has mktCap, no extra call needed
    marketCap:     numOrNull(profile.mktCap),
    price,
    // Company info
    sector:        profile.sector    || null,
    industry:      profile.industry  || null,
    description:   profile.description ? profile.description.slice(0, 280) + '…' : null,
    website:       profile.website   || null,
    employees:     numOrNull(profile.fullTimeEmployees),
    country:       profile.country   || null,
    analystRating: profile.rating    || null,
    targetPrice:   numOrNull(profile.dcfDiff || null),
    fetchedAt:     Date.now(),
    source:        'fmp',
  };
}

async function fmpFetch(path, apiKey) {
  const url = `https://financialmodelingprep.com/api${path}?apikey=${apiKey}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && !json.error) return json;
  return null;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
