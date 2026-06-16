// api/quoteSummary.js — Vercel Edge Function
// Yahoo Finance quoteSummary proxy — fundamentals, earnings calendar, etc.
// Usage: /api/quoteSummary?ticker=AAPL&modules=summaryDetail,defaultKeyStatistics,financialData

export const config = { runtime: 'edge' };

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
};

const ALLOWED_MODULES = new Set([
  'summaryDetail','defaultKeyStatistics','financialData',
  'calendarEvents','earningsTrend','recommendationTrend',
  'assetProfile','incomeStatementHistory','balanceSheetHistory',
]);

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const { searchParams } = new URL(req.url);
  const ticker  = (searchParams.get('ticker') || '').toUpperCase().trim();
  const modules = (searchParams.get('modules') || 'summaryDetail,defaultKeyStatistics,financialData')
    .split(',').filter(m => ALLOWED_MODULES.has(m)).join(',');

  if (!ticker) return new Response(JSON.stringify({ error: 'ticker required' }), { status: 400, headers: HEADERS });
  if (!modules) return new Response(JSON.stringify({ error: 'no valid modules' }), { status: 400, headers: HEADERS });

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FINANCEOS/1.0)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: `Yahoo ${res.status}` }), { status: 502, headers: HEADERS });
    const json = await res.json();
    return new Response(JSON.stringify(json), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
