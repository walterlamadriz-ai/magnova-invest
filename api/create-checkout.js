// api/create-checkout.js — Vercel Edge Function
// Creates a Stripe Checkout session for App purchases or Invest subscriptions
// Usage: POST /api/create-checkout
// Body: { product: 'personal' | 'pro' | 'invest_pro', email?: string, userId?: string }

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://invest.financeospro.com','https://financeospro.com'];
function getCorsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const json = (data, status = 200, req) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req||{headers:{get:()=>''}}) },
  });

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) return json({ error: 'Stripe not configured' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { product, email, userId, successUrl, cancelUrl, interval } = body;

  // Price IDs — set these in Vercel env vars after creating products in Stripe
  const PRICES = {
    personal:          process.env.STRIPE_PRICE_PERSONAL,         // One-time $29.99
    pro:               process.env.STRIPE_PRICE_PRO,               // One-time $49
    invest_pro:        process.env.STRIPE_PRICE_INVEST_PRO,        // Subscription $29.99/mes
    invest_pro_annual: process.env.STRIPE_PRICE_INVEST_PRO_ANNUAL, // Subscription $199/año
  };

  // Route invest_pro to annual price when interval='annual'
  const priceKey = (product === 'invest_pro' && interval === 'annual') ? 'invest_pro_annual' : product;
  const priceId = PRICES[priceKey];
  if (!priceId) return json({ error: `Unknown product or price not configured: ${priceKey}` }, 400);

  const isSubscription = product === 'invest_pro';
  const origin = req.headers.get('origin') || 'https://invest.financeospro.com';

  const sessionPayload = {
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${origin}/activate?session_id={CHECKOUT_SESSION_ID}&product=${product}`,
    cancel_url: cancelUrl || `${origin}/`,
    metadata: { product, userId: userId || '' },
    ...(email ? { customer_email: email } : {}),
    ...(isSubscription ? {
      subscription_data: {
        trial_period_days: 14,
        metadata: { product, userId: userId || '' },
      },
    } : {}),
  };

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(flattenForStripe(sessionPayload)).toString(),
    });
    const session = await res.json();
    if (session.error) return json({ error: session.error.message }, 400);
    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// Stripe API requires form-encoded nested params (e.g. line_items[0][price])
function flattenForStripe(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenForStripe(item, `${key}[${i}]`));
        } else {
          result[`${key}[${i}]`] = item;
        }
      });
    } else if (typeof v === 'object') {
      Object.assign(result, flattenForStripe(v, key));
    } else {
      result[key] = String(v);
    }
  }
  return result;
}
