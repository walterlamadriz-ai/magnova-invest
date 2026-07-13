// api/fundamentals.js — Vercel Edge Function
// Fundamentals via Finnhub API (primary) with FMP fallback
// Finnhub: 200-500ms latency vs FMP 800-2500ms
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com', 'https://app.financeospro.com'];

function buildHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
  };
}

export default async function handler(req) {
  const HEADERS = buildHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const { searchParams } = new URL(req.url);
  const tickersParam = (searchParams.get('ticker') || '').toUpperCase().trim();
  if (!tickersParam) return new Response(JSON.stringify({ error: 'ticker_required' }), { status: 400, headers: HEADERS });

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const fmpKey     = process.env.FMP_API_KEY;

  if (!finnhubKey && !fmpKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 503, headers: HEADERS });
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);

  try {
    const results = await Promise.allSettled(
      tickers.map(t => fetchWithFallback(t, finnhubKey, fmpKey))
    );

    const data = {}, errors = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) data[tickers[i]] = result.value;
      else errors[tickers[i]] = 'unavailable';
    });

    if (Object.keys(data).length === 0) {
      const attempted = [finnhubKey && 'finnhub', fmpKey && 'fmp'].filter(Boolean);
      return new Response(JSON.stringify({ error: 'no_data', details: errors, attemptedSources: attempted }), { status: 404, headers: HEADERS });
    }
    if (Object.keys(errors).length > 0) data._errors = errors;
    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: HEADERS });
  }
}

// ── Finnhub (primary — 200-500ms, 60 req/min free) ──────────────────────────
async function fetchFinnhub(ticker, apiKey) {
  const base = 'https://finnhub.io/api/v1';
  const h = { 'X-Finnhub-Token': apiKey };

  const [metricRes, profileRes] = await Promise.allSettled([
    finnhubGet(`${base}/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all`, h),
    finnhubGet(`${base}/stock/profile2?symbol=${encodeURIComponent(ticker)}`, h),
  ]);

  const m  = metricRes.status  === 'fulfilled' ? metricRes.value?.metric  : null;
  const pr = profileRes.status === 'fulfilled' ? profileRes.value         : null;

  const hasProfile = !!pr?.ticker;
  const hasMetrics = m && Object.values(m).some(v => v !== null && v !== undefined);
  if (!hasProfile && !hasMetrics) return null;

  // Map Finnhub fields to the same shape the frontend expects
  const price    = numOrNull(pr?.['52WeekHigh']) ?? null; // not in profile2, use live
  const lastDiv  = numOrNull(m?.['dividendYieldIndicatedAnnual']);

  return {
    ticker,
    // Valuation
    peRatio:       numOrNull(m?.['peNormalizedAnnual'] ?? m?.['peTTM']),
    forwardPE:     numOrNull(m?.['peForwardAnnual']   ?? m?.['peTTM']),
    priceToBook:   numOrNull(m?.['pbAnnual']          ?? m?.['pbTTM']),
    eps:           numOrNull(m?.['epsTTM']            ?? m?.['epsBasicExclExtraItemsTTM']),
    // Profitability
    grossMargin:   numOrNull(m?.['grossMarginTTM']    ?? m?.['grossMarginAnnual']),
    netMargin:     numOrNull(m?.['netProfitMarginTTM']?? m?.['netProfitMarginAnnual']),
    operatingMargin: numOrNull(m?.['operatingMarginTTM'] ?? m?.['operatingMarginAnnual']),
    roe:           numOrNull(m?.['roeTTM']            ?? m?.['roeAnnual']),
    // Growth
    revenueGrowth: numOrNull(m?.['revenueGrowthTTMYoy'] ?? m?.['revenueGrowth3Y']),
    // Risk
    beta:          numOrNull(m?.['beta']),
    debtToEquity:  numOrNull(m?.['totalDebt/totalEquityAnnual'] ?? m?.['totalDebt/totalEquityQuarterly']),
    // Dividend
    dividendYield: lastDiv ? lastDiv / 100 : null,
    // Market data
    marketCap:     pr?.marketCapitalization ? pr.marketCapitalization * 1e6 : null,
    price:         null, // use LIVE[] price — not duplicating from Finnhub
    // Company info
    sector:        pr?.finnhubIndustry || null,
    industry:      pr?.finnhubIndustry || null,
    description:   null, // Finnhub profile2 has no description; FMP has it
    website:       pr?.weburl || null,
    employees:     numOrNull(pr?.employeeTotal),
    country:       pr?.country || null,
    analystRating: null, // use separate recommendation endpoint if needed
    targetPrice:   null,
    fetchedAt:     Date.now(),
    source:        'finnhub',
  };
}

async function fetchWithFallback(ticker, finnhubKey, fmpKey) {
  if (finnhubKey) {
    try {
      const result = await fetchFinnhub(ticker, finnhubKey);
      if (result) return result;
    } catch (_) {}
  }
  if (fmpKey) {
    try {
      return await fetchFMP(ticker, fmpKey);
    } catch (_) {}
  }
  return null;
}

async function finnhubGet(url, headers) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', ...headers },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json && typeof json === 'object' && !json.error) return json;
  return null;
}

// ── FMP (fallback — used if FINNHUB_API_KEY not set) ────────────────────────
async function fetchFMP(ticker, apiKey) {
  const [profileRes, ratiosRes] = await Promise.allSettled([
    fmpFetch(`/v3/profile/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/v3/ratios-ttm/${encodeURIComponent(ticker)}`, apiKey),
  ]);

  const profile   = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  const ratiosRaw = ratiosRes.status  === 'fulfilled' ? ratiosRes.value        : null;
  const ratios    = Array.isArray(ratiosRaw) ? ratiosRaw[0] : ratiosRaw;

  if (!profile?.symbol) return null;

  const price   = numOrNull(profile.price);
  const lastDiv = numOrNull(profile.lastDividend || profile.lastDiv);

  return {
    ticker,
    peRatio:       numOrNull(ratios?.peRatioTTM),
    forwardPE:     numOrNull(ratios?.priceEarningsRatioTTM),
    priceToBook:   numOrNull(ratios?.priceToBookRatioTTM),
    eps:           numOrNull(ratios?.epsTTM || profile.eps),
    grossMargin:   numOrNull(ratios?.grossProfitMarginTTM),
    netMargin:     numOrNull(ratios?.netProfitMarginTTM),
    operatingMargin: null,
    roe:           numOrNull(ratios?.returnOnEquityTTM),
    revenueGrowth: numOrNull(ratios?.revenueGrowthTTM),
    beta:          numOrNull(profile.beta),
    debtToEquity:  numOrNull(ratios?.debtEquityRatioTTM),
    dividendYield: numOrNull(ratios?.dividendYieldTTM || (lastDiv && price ? lastDiv / price : null)),
    marketCap:     numOrNull(profile.mktCap),
    price,
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
    signal: AbortSignal.timeout(5000),
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
