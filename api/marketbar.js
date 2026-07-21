// api/marketbar.js — Vercel Edge Function
// Barra de mercado: 11 simbolos con precio, variacion y sparkline.
// Usage: GET /api/marketbar
//
// Antes usaba v7/finance/quote, el unico endpoint del repo que quedaba en v7.
// Yahoo lo cerro detras de cookie+crumb y devuelve 401, asi que quoteMap salia
// vacio y entraba un fallback con slice(0,6): de los 11 simbolos solo llegaban
// los 6 primeros (S&P, Dow, Nasdaq, Russell, Crude, Gold) y faltaban VIX,
// Bitcoin, Silver, EUR/USD y el bono a 10 anos.
//
// Ahora se pide v8/finance/chart por simbolo en paralelo, igual que quote.js.
// Esa misma respuesta trae el precio Y los cierres del dia, asi que tambien
// desaparece la llamada a v8/finance/spark: un endpoint menos que puede fallar.
// Cada simbolo se resuelve por separado: si uno cae, los otros diez siguen.

export const config = { runtime: 'edge' };

const SYMBOLS = [
  { sym: '^GSPC',    label: 'S&P 500'      },
  { sym: '^DJI',     label: 'Dow 30'       },
  { sym: '^IXIC',    label: 'Nasdaq'       },
  { sym: '^RUT',     label: 'Russell 2000' },
  { sym: 'CL=F',     label: 'Crude Oil'    },
  { sym: 'GC=F',     label: 'Gold'         },
  { sym: 'SI=F',     label: 'Silver'       },
  { sym: 'EURUSD=X', label: 'EUR/USD'      },
  { sym: '^TNX',     label: '10-Yr Bond'   },
  { sym: 'BTC-USD',  label: 'Bitcoin'      },
  { sym: '^VIX',     label: 'VIX'          },
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

async function fetchSymbol(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=30m&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} en ${sym}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const price = meta?.regularMarketPrice;
  if (!price) throw new Error(`sin precio para ${sym}`);

  const prev = meta.chartPreviousClose || meta.previousClose || price;
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter(v => v != null);

  return {
    price,
    change: price - prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    spark: closes.length > 1 ? closes : null,
  };
}

export default async function handler(req) {
  const CORS = buildCors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const resultados = await Promise.allSettled(SYMBOLS.map(s => fetchSymbol(s.sym)));

  const items = [];
  const fallidos = [];
  resultados.forEach((r, i) => {
    const s = SYMBOLS[i];
    if (r.status === 'fulfilled') {
      items.push({ sym: s.sym, label: s.label, ...r.value });
    } else {
      fallidos.push(s.sym);
    }
  });

  // Se informan los fallidos para que el cliente pueda distinguir "no cargo"
  // de "no existe", en vez de mostrar un valor viejo como si fuera actual.
  return new Response(
    JSON.stringify({ items, missing: fallidos, fetchedAt: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...CORS,
      },
    }
  );
}
