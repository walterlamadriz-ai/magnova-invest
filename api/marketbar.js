// api/marketbar.js — Vercel Edge Function
// Yahoo Finance market summary bar: 12 symbols with price, change, sparkline
// Usage: GET /api/marketbar
export const config = { runtime: 'edge' };

const SYMBOLS = [
  { sym: '^GSPC',    label: 'S&P 500'     },
  { sym: '^DJI',     label: 'Dow 30'      },
  { sym: '^IXIC',    label: 'Nasdaq'      },
  { sym: '^RUT',     label: 'Russell 2000' },
  { sym: 'CL=F',     label: 'Crude Oil'   },
  { sym: 'GC=F',     label: 'Gold'        },
  { sym: 'SI=F',     label: 'Silver'      },
  { sym: 'EURUSD=X', label: 'EUR/USD'     },
  { sym: '^TNX',     label: '10-Yr Bond'  },
  { sym: 'BTC-USD',  label: 'Bitcoin'     },
  { sym: '^VIX',     label: 'VIX'         },
];

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com', 'https://app.financeospro.com'];

function buildCors(req) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export default async function handler(req) {
  const CORS = buildCors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const syms = SYMBOLS.map(s => s.sym).join(',');

    // Batch quote + sparkline data
    const [quoteRes, sparkRes] = await Promise.allSettled([
      fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,shortName`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        }
      ),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(syms)}&range=1d&interval=30m`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        }
      ),
    ]);

    // Parse quotes
    const quoteMap = {};
    if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
      const qData = await quoteRes.value.json();
      for (const q of (qData?.quoteResponse?.result || [])) {
        quoteMap[q.symbol] = {
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePct: q.regularMarketChangePercent,
        };
      }
    }

    // Parse sparklines
    const sparkMap = {};
    if (sparkRes.status === 'fulfilled' && sparkRes.value.ok) {
      const sData = await sparkRes.value.json();
      for (const [sym, val] of Object.entries(sData?.spark?.result || {})) {
        const closes = val?.response?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
        if (closes.length > 1) sparkMap[sym] = closes;
      }
    }

    // Fallback: individual chart calls if batch failed
    const missing = SYMBOLS.filter(s => !quoteMap[s.sym]);
    if (missing.length && Object.keys(quoteMap).length === 0) {
      const fallbacks = await Promise.allSettled(
        missing.slice(0, 6).map(s =>
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.sym)}?interval=30m&range=1d`, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(4000),
          }).then(r => r.json()).then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
            if (meta?.regularMarketPrice) {
              const price = meta.regularMarketPrice;
              const prev = meta.chartPreviousClose || meta.previousClose || price;
              quoteMap[s.sym] = { price, change: price - prev, changePct: prev ? ((price - prev) / prev) * 100 : 0 };
              if (closes.length > 1) sparkMap[s.sym] = closes;
            }
          })
        )
      );
    }

    const items = SYMBOLS.map(s => ({
      sym: s.sym,
      label: s.label,
      ...(quoteMap[s.sym] || { price: null, change: null, changePct: null }),
      spark: sparkMap[s.sym] || null,
    })).filter(s => s.price !== null);

    return new Response(JSON.stringify({ items, fetchedAt: Date.now() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...CORS,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
