// api/crypto.js — Vercel Edge Function
// CoinGecko proxy for crypto holdings in Portfolio (pos.type === "Crypto").
// Public "simple/price" endpoint — no API key required, generous but limited
// rate limit, so results are cached at the edge (same Cache-Control pattern
// as api/quote.js) instead of hitting CoinGecko on every request.
// Usage: /api/crypto?symbols=BTC,ETH,BTC-USD  (accepts plain tickers or the
//        "-USD"/"-USDT" suffixed form already used elsewhere in the app,
//        e.g. the "BTC-USD" ticker seeded in index.html's portfolio helpers)

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com', 'https://app.financeospro.com'];

function buildHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
    // Crypto moves fast, but CoinGecko's free tier is rate-limited — cache at
    // the edge like the other market-data endpoints instead of calling on
    // every request.
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  };
}

// Ticker → CoinGecko coin id. Covers the top ~60 coins by market cap plus a
// few LATAM-relevant / commonly-held ones. Not exhaustive — CoinGecko has
// 10k+ listed coins and resolving arbitrary symbols needs the (heavier)
// /coins/list endpoint, out of scope for "add real prices to the existing
// Crypto position type". Unmapped symbols come back as errors, same shape
// as quote.js's "ticker_not_found".
const SYMBOL_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', BNB: 'binancecoin', SOL: 'solana',
  USDC: 'usd-coin', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', TRX: 'tron',
  AVAX: 'avalanche-2', DOT: 'polkadot', MATIC: 'matic-network', POL: 'polygon-ecosystem-token',
  LINK: 'chainlink', TON: 'the-open-network', SHIB: 'shiba-inu', LTC: 'litecoin',
  BCH: 'bitcoin-cash', UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar', ETC: 'ethereum-classic',
  FIL: 'filecoin', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', NEAR: 'near',
  ICP: 'internet-computer', HBAR: 'hedera-hashgraph', VET: 'vechain', ALGO: 'algorand',
  QNT: 'quant-network', AAVE: 'aave', GRT: 'the-graph', SAND: 'the-sandbox',
  MANA: 'decentraland', EOS: 'eos', XTZ: 'tezos', THETA: 'theta-token', AXS: 'axie-infinity',
  FTM: 'fantom', EGLD: 'elrond-erd-2', FLOW: 'flow', CHZ: 'chiliz', XMR: 'monero',
  CRO: 'crypto-com-chain', MKR: 'maker', RUNE: 'thorchain', ZEC: 'zcash', DASH: 'dash',
  COMP: 'compound-governance-token', SNX: 'havven', CAKE: 'pancakeswap-token',
  ENJ: 'enjincoin', BAT: 'basic-attention-token', ZIL: 'zilliqa', WAVES: 'waves',
  KSM: 'kusama', GALA: 'gala', SUI: 'sui', SEI: 'sei-network', INJ: 'injective-protocol',
  TIA: 'celestia', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', RENDER: 'render-token',
  IMX: 'immutable-x', STX: 'blockstack', LDO: 'lido-dao', OKB: 'okb',
};

function normalizeSymbol(raw) {
  return raw.toUpperCase().trim().replace(/-USDT$|-USD$|USDT$|USD$/, '') || raw.toUpperCase().trim();
}

export default async function handler(req) {
  const HEADERS = buildHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('symbols') || searchParams.get('ticker') || '';
  const invalid = raw.split(',').some(t => !/^[A-Z0-9\-]{1,15}$/i.test(t.trim()));
  if (invalid) return new Response(JSON.stringify({ error: 'invalid_symbol' }), { status: 400, headers: HEADERS });

  const requested = raw.toUpperCase().split(',').map(t => t.trim()).filter(Boolean).slice(0, 30);
  if (!requested.length) {
    return new Response(JSON.stringify({ error: 'symbols_required' }), { status: 400, headers: HEADERS });
  }

  // symbol (as sent by the client, e.g. "BTC-USD") → coingecko id
  const bySymbol = {};
  const unknown = [];
  requested.forEach(sym => {
    const id = SYMBOL_MAP[normalizeSymbol(sym)];
    if (id) bySymbol[sym] = id;
    else unknown.push(sym);
  });

  const ids = [...new Set(Object.values(bySymbol))];
  if (!ids.length) {
    return new Response(JSON.stringify({ error: 'no_known_symbols', details: unknown }), { status: 404, headers: HEADERS });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}` +
      `&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `coingecko_${res.status}` }), { status: 502, headers: HEADERS });
    }

    const json = await res.json();
    const data = {};
    const errors = {};

    Object.entries(bySymbol).forEach(([sym, id]) => {
      const c = json[id];
      if (!c || typeof c.usd !== 'number') { errors[sym] = 'unavailable'; return; }
      const price = c.usd;
      const changePct = typeof c.usd_24h_change === 'number' ? c.usd_24h_change / 100 : 0;
      const prevClose = changePct !== 0 && (1 + changePct) !== 0 ? price / (1 + changePct) : price;
      data[sym] = {
        ticker: sym,
        price,
        prevClose,
        change: price - prevClose,
        changePct,
        volume: c.usd_24h_vol || 0,
        marketCap: c.usd_market_cap || 0,
        high52: null,
        low52: 0,
        currency: 'USD',
        fetchedAt: Date.now(),
        source: 'coingecko',
      };
    });

    unknown.forEach(sym => { errors[sym] = 'unknown_symbol'; });

    if (Object.keys(data).length === 0) {
      return new Response(JSON.stringify({ error: 'no_data', details: errors }), { status: 404, headers: HEADERS });
    }
    if (Object.keys(errors).length > 0) data._errors = errors;

    return new Response(JSON.stringify(data), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
