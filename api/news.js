// api/news.js — Vercel Edge Function
// Fetches live financial news from Yahoo Finance RSS
// Usage: GET /api/news?tickers=SPY,NVDA,AAPL
export const config = { runtime: 'edge' };

function parseRSS(xml) {
  const items = [];
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const m of matches) {
    const c = m[1];
    const g = (tag, cdata) => {
      if (cdata) return c.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] || '';
      return c.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() || '';
    };
    const title = g('title', true) || g('title');
    const link  = g('link') || g('guid');
    const pub   = g('pubDate');
    const desc  = g('description', true) || g('description');
    const src   = g('source', true) || g('source') || 'Yahoo Finance';
    if (title) items.push({ title, link, pubDate: pub, description: desc.replace(/<[^>]+>/g,'').slice(0,200), source: src });
  }
  return items;
}

function hoursAgo(dateStr) {
  if (!dateStr) return 24;
  const d = new Date(dateStr);
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 3600000));
}

function guessImpact(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (/crash|crisis|recession|war|sanctions|ban|collapse|default|downgrade/.test(text)) return 'bearish';
  if (/beat|surge|rally|record|growth|profit|gain|upgrade|bull/.test(text)) return 'bullish';
  if (/breaking|alert|urgent|shock/.test(text)) return 'critical';
  return 'neutral';
}

function guessCat(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (/fed|fomc|rates|powell|inflation|cpi|pce|treasury/.test(text)) return 'Fed';
  if (/earnings|eps|revenue|guidance|quarterly|beat|miss/.test(text)) return 'Earnings';
  if (/war|sanctions|geopolit|iran|russia|china|israel|conflict|tariff/.test(text)) return 'Geopolítica';
  if (/ai|artificial|nvidia|semiconductor|tech|apple|google|meta|amazon/.test(text)) return 'IA & Tech';
  return 'Macro';
}

export default async function handler(req) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const tickers = searchParams.get('tickers') || 'SPY,QQQ,NVDA,AAPL,AMZN,META,MSFT,GLD';

  try {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickers}&region=US&lang=en-US`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'FINANCEOS/1.0' } });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();
    const raw = parseRSS(xml).slice(0, 20);

    const items = raw.map((n, i) => ({
      id: 100 + i,
      cat: guessCat(n.title, n.description),
      impact: guessImpact(n.title, n.description),
      breaking: i < 2 && hoursAgo(n.pubDate) < 3,
      title: n.title,
      body: n.description || n.title,
      tickers: [],
      dec: '',
      decColor: 'var(--text2)',
      key: '',
      source: n.source,
      link: n.link,
      hoursAgo: hoursAgo(n.pubDate),
    }));

    return new Response(JSON.stringify({ items, fetchedAt: Date.now() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
