// api/quoteSummary.js — DEPRECATED
// Yahoo Finance v10/quoteSummary returns 401 (blocked). This endpoint is decommissioned.
// Fundamentals are now served via /api/fundamentals (FMP).

export const config = { runtime: 'edge' };

export default async function handler(req) {
  return new Response(
    JSON.stringify({ error: 'This endpoint is deprecated. Use /api/fundamentals instead.', deprecated: true }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
