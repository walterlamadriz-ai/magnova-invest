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
  const [quoteRes, profileRes] = await Promise.allSettled([
    fmpFetch(`/v3/quote/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/profile/${encodeURIComponent(ticker)}`, apiKey),
  ]);
  const quote   = quoteRes.status   === 'fulfilled' ? quoteRes.value?.[0]   : null;
  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  if (!quote?.symbol && !profile?.symbol) return null;
  return {
    ticker,
    pe:            numOrNull(quote?.pe),
    eps:           numOrNull(quote?.eps),
    marketCap:     numOrNull(quote?.marketCap),
    price:         numOrNull(quote?.price),
    beta:          numOrNull(profile?.beta),
    dividendYield: numOrNull(profile?.lastDiv && profile?.price ? (profile.lastDiv / profile.price) * 100 : null),
    sector:        profile?.sector   || null,
    industry:      profile?.industry || null,
    fetchedAt:     Date.now(),
    source:        'fmp',
  };
}
async function fmpFetch(path, apiKey) {
  const url = `https://financialmodelingprep.com/api${path}?apikey=${apiKey}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json) ? json : null;
}
function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
