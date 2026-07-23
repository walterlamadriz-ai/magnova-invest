// api/billing-portal.js — Vercel Edge Function
// Abre el Billing Portal de Stripe: el usuario cancela la suscripcion, cambia
// de tarjeta o ve sus facturas. Antes no habia forma de cancelar desde la app,
// aunque la copy decia "cancela cuando quieras".
// Usage: POST /api/billing-portal  { token: "<supabase access token>" }
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com'];
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

function cors(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
const json = (data, status, req) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(req || { headers: { get: () => '' } }) },
  });

export default async function handler(req) {
  const c = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);
  if (!STRIPE_SECRET) return json({ error: 'Stripe no configurado' }, 500, req);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ error: 'Server misconfigured' }, 500, req);

  let token;
  try { token = (await req.json()).token; } catch { return json({ error: 'Invalid JSON' }, 400, req); }
  if (!token) return json({ error: 'Missing token' }, 400, req);

  // Verificar el JWT y obtener el usuario. El cliente NO envia el customer_id:
  // se resuelve server-side desde el perfil para que nadie pueda abrir el portal
  // de otra cuenta pasando un id ajeno.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: 'No autorizado' }, 401, req);
  const userId = (await userRes.json())?.id;
  if (!userId) return json({ error: 'No autorizado' }, 401, req);

  const profRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const customerId = profRes.ok ? (await profRes.json())?.[0]?.stripe_customer_id : null;
  if (!customerId) {
    return json({ error: 'No hay una suscripcion activa asociada a esta cuenta.' }, 404, req);
  }

  const origin = req.headers.get('origin') || 'https://invest.financeospro.com';
  const params = new URLSearchParams();
  params.set('customer', customerId);
  params.set('return_url', `${origin}/app`);

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!portalRes.ok) {
    const errTxt = await portalRes.text().catch(() => '');
    return json({ error: 'Stripe portal error', detail: errTxt.slice(0, 200) }, 502, req);
  }
  const session = await portalRes.json();
  return json({ url: session.url }, 200, req);
}
