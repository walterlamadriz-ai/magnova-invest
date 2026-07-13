// api/fx-latam.js — Vercel Edge Function
// Returns live USD → LATAM currency rates via Yahoo Finance
// Currencies: CLP, MXN, COP, ARS, PEN
// Usage: GET /api/fx-latam

export const config = { runtime: 'edge' };

const PAIRS = {
  CLP: 'USDCLP=X',
  MXN: 'USDMXN=X',
  COP: 'USDCOP=X',
  ARS: 'USDARS=X',
  PEN: 'USDPEN=X',
};

const FALLBACKS = { CLP: 960, MXN: 17.3, COP: 4200, ARS: 1060, PEN: 3.75 }; // updated Jul 2026 — ARS es tipo oficial BCRA

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

async function fetchRate(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'FINANCEOS/1.0' } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!price) throw new Error(`no price for ${symbol}`);
  return price;
}

export default async function handler(req) {
  const HEADERS = buildHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const rates = {};
  const sources = {};

  await Promise.all(Object.entries(PAIRS).map(async ([currency, symbol]) => {
    try {
      rates[currency] = await fetchRate(symbol);
      sources[currency] = 'yahoo';
    } catch {
      rates[currency] = FALLBACKS[currency];
      sources[currency] = 'fallback';
    }
  }));

  // Also try mindicador.cl for CLP as authoritative source
  try {
    const r = await fetch('https://mindicador.cl/api/dolar', { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      const v = d?.serie?.[0]?.valor;
      if (v) { rates.CLP = v; sources.CLP = 'mindicador'; }
    }
  } catch { /* keep Yahoo rate */ }

  return new Response(JSON.stringify({ rates, sources, updatedAt: new Date().toISOString() }), {
    status: 200,
    headers: HEADERS,
  });
}
