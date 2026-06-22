// api/news.js — Vercel Edge Function
// Fetches live financial news from Yahoo Finance Search API (includes thumbnails)
// Usage: GET /api/news?tickers=SPY,NVDA,AAPL
export const config = { runtime: 'edge' };

function hoursAgo(ts) {
  if (!ts) return 24;
  const d = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  return Math.max(0, Math.round((Date.now() - d) / 3600000));
}

function guessImpact(title) {
  const t = title.toLowerCase();
  if (/crash|crisis|recession|war|sanctions|ban|collapse|default|downgrade/.test(t)) return 'bearish';
  if (/beat|surge|rally|record|growth|profit|gain|upgrade|bull/.test(t)) return 'bullish';
  if (/breaking|alert|urgent|shock/.test(t)) return 'critical';
  return 'neutral';
}

function guessCat(title) {
  const t = title.toLowerCase();
  if (/fed|fomc|rates|powell|inflation|cpi|pce|treasury/.test(t)) return 'Fed';
  if (/earnings|eps|revenue|guidance|quarterly|beat|miss/.test(t)) return 'Earnings';
  if (/war|sanctions|geopolit|iran|russia|china|israel|conflict|tariff/.test(t)) return 'Geopolítica';
  if (/ai|artificial|nvidia|semiconductor|tech|apple|google|meta|amazon/.test(t)) return 'IA & Tech';
  return 'Macro';
}

function bestImage(thumbnail) {
  if (!thumbnail?.resolutions?.length) return null;
  // prefer largest resolution, avoid tiny icons
  const sorted = [...thumbnail.resolutions].sort((a, b) => (b.width || 0) - (a.width || 0));
  const best = sorted.find(r => (r.width || 0) >= 200) || sorted[0];
  return best?.url || null;
}

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const rawTickers = searchParams.get('tickers') || 'SPY,QQQ,NVDA,AAPL,AMZN,META,MSFT,GLD';
  const tickers = rawTickers
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => /^[\^A-Z0-9\-=\.]{1,15}$/.test(t))
    .slice(0, 12)
    .join(',') || 'SPY,QQQ,NVDA,AAPL';

  const respond = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        ...corsHeaders,
      },
    });

  try {
    // Yahoo Finance Search API returns news with thumbnails in one call
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(tickers)}&newsCount=25&enableNavLinks=false&enableEnhancedTrivialQuery=true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`Yahoo API ${res.status}`);
    const data = await res.json();

    const raw = data.news || [];
    if (!raw.length) throw new Error('empty_response');

    const items = raw.map((n, i) => ({
      id: 100 + i,
      cat: guessCat(n.title || ''),
      impact: guessImpact(n.title || ''),
      breaking: i < 2 && hoursAgo(n.providerPublishTime) < 3,
      title: n.title || '',
      body: n.title || '',
      tickers: (n.relatedTickers || []).slice(0, 4),
      dec: '',
      decColor: 'var(--text2)',
      key: '',
      source: n.publisher || 'Yahoo Finance',
      link: n.link || '',
      hoursAgo: hoursAgo(n.providerPublishTime),
      image: bestImage(n.thumbnail),
    }));

    return respond({ items, fetchedAt: Date.now() });
  } catch (e) {
    // Fallback to RSS if Search API fails
    try {
      const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickers}&region=US&lang=en-US`;
      const rssRes = await fetch(rssUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'FINANCEOS/1.0' },
      });
      if (!rssRes.ok) throw new Error(`RSS ${rssRes.status}`);
      const xml = await rssRes.text();

      const raw = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
      const items = raw.map((m, i) => {
        const c = m[1];
        const g = (tag, cd) => cd
          ? c.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))?.[1] || ''
          : c.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || '';
        const title = g('title', true) || g('title');
        const link  = g('link') || g('guid');
        const pub   = g('pubDate');
        const desc  = (g('description', true) || '').replace(/<[^>]+>/g, '').slice(0, 200);
        const src   = g('source', true) || g('source') || 'Yahoo Finance';
        // Try media:content for image in RSS
        const mediaMatch = c.match(/<media:content[^>]+url="([^"]+)"/i);
        const image = mediaMatch?.[1] || null;
        return {
          id: 100 + i,
          cat: guessCat(title),
          impact: guessImpact(title),
          breaking: i < 2 && hoursAgo(pub) < 3,
          title,
          body: desc || title,
          tickers: [],
          dec: '',
          decColor: 'var(--text2)',
          key: '',
          source: src,
          link,
          hoursAgo: hoursAgo(pub),
          image,
        };
      }).filter(n => n.title);

      return respond({ items, fetchedAt: Date.now(), fallback: true });
    } catch (e2) {
      return respond({ error: e2.message, items: [] });
    }
  }
}
