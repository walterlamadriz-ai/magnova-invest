// api/check-plan.js — Vercel Edge Function
// Validates a Supabase JWT and returns the user's real plan from the DB.
// Called by the client before rendering Pro features to prevent client-side bypass.
// POST /api/check-plan  { token: "<supabase access token>" }

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = ['https://invest.financeospro.com', 'https://financeospro.com'];

function cors(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, req) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(req || { headers: { get: () => '' } }) },
  });
}

export default async function handler(req) {
  const corsHeaders = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ error: 'Server misconfigured' }, 500, req);

  let token;
  try {
    const body = await req.json();
    token = body.token;
  } catch { return json({ error: 'Invalid JSON' }, 400, req); }

  if (!token) return json({ error: 'Missing token' }, 400, req);

  // Verify the JWT with Supabase and get the user id
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ plan: 'free', valid: false }, 200, req);
  const userData = await userRes.json();
  const userId = userData?.id;
  if (!userId) return json({ plan: 'free', valid: false }, 200, req);

  // Fetch the real plan from profiles using service_role (bypasses RLS)
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,trial_started_at,stripe_subscription_id,trial_used`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!profRes.ok) return json({ plan: 'free', valid: true }, 200, req);
  const profiles = await profRes.json();
  const profile = profiles?.[0];
  if (!profile) return json({ plan: 'free', valid: true }, 200, req);

  // Verify trial hasn't expired (14 days)
  let plan = profile.plan || 'free';
  if (plan === 'trial' && profile.trial_started_at) {
    const started = new Date(profile.trial_started_at).getTime();
    const elapsed = Date.now() - started;
    if (elapsed > 14 * 24 * 60 * 60 * 1000) plan = 'free';
  }

  const trialUsed = profile.trial_used || false;

  return json({ plan, valid: true, trialUsed }, 200, req);
}
