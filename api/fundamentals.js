// api/fundamentals.js — Vercel Edge Function
// Fundamentals via Financial Modeling Prep (FMP) API
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
    if (Object.keys(data).length === 0) return new Response(JSON.stringify({ error: 'no_data', details: errors }), { status: 404, headers: HEADERS });
    if (Object.keys(errors).length > 0) data._errors = errors;
    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: HEADERS });
  }
}
async function fetchFundamentals(ticker, apiKey) {
  const [quoteRes, profileRes, ratiosRes, metricsRes] = await Promise.allSettled([
    fmpFetch(`/v3/quote/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/profile/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/ratios-ttm/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/key-metrics-ttm/${encodeURIComponent(ticker)}`, apiKey),
  ]);
  const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value?.[0]   : null;
  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  // ratios and metrics return a single object (not array) in some FMP versions
  const ratiosRaw = ratiosRes.status === 'fulfilled' ? ratiosRes.value : null;
  const ratios  = Array.isArray(ratiosRaw) ? ratiosRaw[0] : ratiosRaw;
  const metricsRaw = metricsRes.status === 'fulfilled' ? metricsRes.value : null;
  const metrics = Array.isArray(metricsRaw) ? metricsRaw[0] : metricsRaw;

  if (!quote?.symbol && !profile?.symbol) return null;

  const lastDiv = numOrNull(profile?.lastDividend || profile?.lastDiv);
  const price   = numOrNull(quote?.price || profile?.price);

  return {
    ticker,
    // Valuation
    peRatio:        numOrNull(quote?.pe        || ratios?.peRatioTTM),
    forwardPE:      numOrNull(ratios?.priceEarningsRatioTTM || metrics?.peRatioTTM),
    priceToBook:    numOrNull(ratios?.priceToBookRatioTTM   || metrics?.pbRatioTTM),
    eps:            numOrNull(quote?.eps       || ratios?.epsTTM),
    // Profitability
    grossMargin:    numOrNull(ratios?.grossProfitMarginTTM),
    netMargin:      numOrNull(ratios?.netProfitMarginTTM),
    roe:            numOrNull(ratios?.returnOnEquityTTM),
    // Growth
    revenueGrowth:  numOrNull(metrics?.revenueGrowth || ratios?.revenueGrowthTTM),
    // Risk
    beta:           numOrNull(profile?.beta),
    debtToEquity:   numOrNull(ratios?.debtEquityRatioTTM),
    // Dividend
    dividendYield:  numOrNull(ratios?.dividendYieldTTM || (lastDiv && price ? lastDiv / price : null)),
    // Market data
    marketCap:      numOrNull(quote?.marketCap || profile?.mktCap),
    price:          price,
    // Company info
    sector:         profile?.sector   || null,
    industry:       profile?.industry || null,
    description:    profile?.description ? profile.description.slice(0, 280) + '…' : null,
    website:        profile?.website  || null,
    employees:      numOrNull(profile?.fullTimeEmployees),
    country:        profile?.country  || null,
    // Analyst targets from FMP
    targetPrice:    numOrNull(quote?.targetPrice || quote?.priceAvg50),
    analystRating:  quote?.analystRating || null,
    fetchedAt:      Date.now(),
    source:         'fmp',
  };
}
async function fmpFetch(path, apiKey) {
  const url = `https://financialmodelingprep.com/api${path}?apikey=${apiKey}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const json = await res.json();
  // Some endpoints return array, others return object directly
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && !json.error) return json;
  return null;
}
function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
