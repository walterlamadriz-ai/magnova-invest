// api/fx.js — Vercel Edge Function
// USD/CLP exchange rate from Banco Central de Chile (mindicador.cl)
// Usage: /api/fx

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  try {
    const res = await fetch('https://mindicador.cl/api/dolar', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) throw new Error(`mindicador returned ${res.status}`);

    const data = await res.json();
    const value = data?.serie?.[0]?.valor;

    if (!value) throw new Error('no value in response');

    return new Response(JSON.stringify({
      usdClp: value,
      date:   data?.serie?.[0]?.fecha || new Date().toISOString(),
      source: 'Banco Central de Chile',
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    // Return fallback value rather than failing completely
    return new Response(JSON.stringify({
      usdClp: 950,
      date:   new Date().toISOString(),
      source: 'fallback',
      error:  err.message,
    }), { status: 200, headers: HEADERS });
  }
}
