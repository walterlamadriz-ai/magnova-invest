// api/earnings.js — Vercel Edge Function
// FMP earnings-surprises: últimos 8 trimestres + próxima fecha
export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get('ticker') || '').toUpperCase().trim();
  if (!ticker) return new Response(JSON.stringify({ error: 'ticker_required' }), { status: 400, headers: HEADERS });

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 503, headers: HEADERS });

  try {
    const [surprisesRes, calendarRes] = await Promise.allSettled([
      fmpFetch(`/v3/earnings-surprises/${encodeURIComponent(ticker)}`, apiKey),
      fmpFetch(`/v3/historical/earning_calendar/${encodeURIComponent(ticker)}`, apiKey),
    ]);

    const surprises = surprisesRes.status === 'fulfilled' ? surprisesRes.value : null;
    const calendar  = calendarRes.status === 'fulfilled'  ? calendarRes.value  : null;

    // Next earnings date: first future date from calendar
    const today = new Date().toISOString().slice(0, 10);
    const next = Array.isArray(calendar)
      ? calendar.find(e => e.date >= today)
      : null;

    const quarters = Array.isArray(surprises)
      ? surprises.slice(0, 8).map(q => ({
          date:              q.date             || null,
          fiscalEnd:         q.fiscalDateEnding || null,
          eps:               numOrNull(q.eps),
          epsEst:            numOrNull(q.epsEstimated),
          revenue:           numOrNull(q.revenue),
          revenueEst:        numOrNull(q.revenueEstimated),
          beat: q.eps != null && q.epsEstimated != null
            ? numOrNull(q.eps) >= numOrNull(q.epsEstimated)
            : null,
        }))
      : [];

    return new Response(JSON.stringify({
      ticker,
      nextDate: next?.date || null,
      nextEpsEst: numOrNull(next?.epsEstimated),
      quarters,
      fetchedAt: Date.now(),
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: HEADERS });
  }
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
