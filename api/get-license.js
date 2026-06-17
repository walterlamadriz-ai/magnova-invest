// api/get-license.js — Vercel Edge Function
// Retrieves license key for a completed Stripe checkout session
// Usage: GET /api/get-license?session_id=cs_xxx
// Called by activate.html after Stripe redirects the user back

export const config = { runtime: 'edge' };

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = ['https://invest.financeospro.com','https://financeospro.com'];
function getCorsHeaders(req) {
  const origin = (req&&req.headers&&req.headers.get('origin')) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
}

export default async function handler(req) {
  const cors = getCorsHeaders(req);
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) return json({ error: 'session_id required' }, 400);
  if (!STRIPE_SECRET) return json({ error: 'Stripe not configured' }, 500);

  // 1. Verify session with Stripe
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  const session = await stripeRes.json();

  if (session.error) return json({ error: 'Invalid session' }, 400);
  if (session.payment_status !== 'paid' && session.mode !== 'subscription') {
    return json({ error: 'Payment not completed' }, 402);
  }

  const product = session.metadata?.product;

  // 2. For App purchases, fetch license from Supabase
  if (product === 'personal' || product === 'pro') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: 'Database not configured' }, 500);
    }

    // Webhook may take a few seconds — retry up to 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/licenses?stripe_session_id=eq.${sessionId}&select=key,plan,customer_email`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const rows = await res.json();
      if (rows && rows.length > 0) {
        const { key, plan, customer_email } = rows[0];
        return json({ key, plan, email: customer_email, product });
      }
      // Wait 1.5s before retry
      await new Promise(r => setTimeout(r, 1500));
    }
    return json({ error: 'License not found — contact support@financeospro.com' }, 404);
  }

  // 3. For Invest subscription, just confirm activation
  if (product === 'invest_pro') {
    return json({
      product,
      plan: 'pro',
      email: session.customer_details?.email,
      activated: true,
    });
  }

  return json({ error: 'Unknown product' }, 400);
}
