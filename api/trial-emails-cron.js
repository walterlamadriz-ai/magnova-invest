// api/trial-emails-cron.js — Vercel Edge Function (daily cron)
// Sends the trial nurture sequence to Pro-trial users at day 1, 7, 12 and 14.
// Finds trial users in Supabase, computes days elapsed, sends via Resend,
// and records each send in the `trial_emails` table to avoid duplicates.
//
// Triggered daily by Vercel Cron (see vercel.json). Vercel adds the
// `x-vercel-cron` header automatically. Can also be invoked manually with
//   Authorization: Bearer ${CRON_SECRET}
//
// Env vars required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_KEY,
//                    RESEND_API_KEY, CRON_SECRET

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const APP_URL = 'https://invest.financeospro.com';
const FROM = 'FinanceOS Invest <invest@financeospro.com>';

// Which day-marks trigger which template
const SCHEDULE = { 1: 'welcome', 7: 'midpoint', 12: 'urgency', 14: 'lastday' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sbFetch(path, method = 'GET', body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// profiles has no email column → resolve email via the auth admin API
async function getUserEmail(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.email || null;
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, id: data?.id || null, error: res.ok ? null : data };
}

// ── Email shell (email-safe, inline CSS, table layout, no external assets) ──
function shell(headline, bodyHtml, ctaLabel) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e17;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e17;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px 32px;">
<span style="font-size:18px;font-weight:700;color:#22c55e;">FinanceOS</span><span style="font-size:18px;font-weight:700;color:#e5e7eb;"> Invest</span>
</td></tr>
<tr><td style="padding:8px 32px 0 32px;">
<h1 style="margin:12px 0 16px 0;font-size:24px;line-height:1.3;color:#f9fafb;">${headline}</h1>
</td></tr>
<tr><td style="padding:0 32px 8px 32px;font-size:16px;line-height:1.6;color:#cbd5e1;">
${bodyHtml}
</td></tr>
<tr><td style="padding:24px 32px 28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="border-radius:10px;background:#22c55e;">
<a href="${APP_URL}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#052e16;text-decoration:none;border-radius:10px;">${ctaLabel}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #1f2937;font-size:12px;line-height:1.6;color:#6b7280;">
FinanceOS Invest te ofrece herramientas de análisis y seguimiento de mercado. No es asesoría de inversión.<br>
¿No quieres recibir estos correos? Responde a <a href="mailto:invest@financeospro.com" style="color:#9ca3af;">invest@financeospro.com</a> y te damos de baja.<br>
<a href="${APP_URL}/privacy.html" style="color:#9ca3af;">Política de privacidad</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Templates ──────────────────────────────────────────────────────────────
function tplWelcome() {
  return {
    subject: 'Tu prueba Pro está activa — esto es lo que desbloqueaste',
    html: shell(
      'Bienvenido a tu prueba Pro de 14 días',
      `<p>Ya tienes acceso completo a las herramientas Pro de FinanceOS Invest. Esto es lo que puedes empezar a usar hoy:</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Motor de Análisis</strong> — lectura integral de cada activo.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Comparador</strong> — contrasta varios activos lado a lado.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Position Builder</strong> — arma y organiza tus posiciones.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Screener sin límite</strong> — filtra todo el universo de activos.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Indicadores técnicos</strong> — seguimiento con las principales métricas.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Rebalanceo</strong> — mantén tu cartera alineada con tu plan.</li>
      </ul>
      <p>Tómate unos minutos para explorar. Cuanto antes conozcas las herramientas, más provecho le sacas a tu prueba.</p>`,
      'Explorar mi cuenta Pro'
    ),
  };
}

function tplMidpoint() {
  return {
    subject: 'Vas por la mitad de tu prueba Pro',
    html: shell(
      'Ya estás a mitad de camino',
      `<p>Llevas una semana con acceso Pro. Inversores en toda LATAM usan estas herramientas cada día para hacer seguimiento de sus carteras con más contexto.</p>
      <p>Si aún no las probaste, te recomendamos dos que suelen pasar desapercibidas:</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Comparador</strong> — pon varios activos lado a lado y observa sus indicadores en una sola vista.</li>
        <li style="margin-bottom:8px;"><strong style="color:#e5e7eb;">Rebalanceo</strong> — revisa cómo se distribuye tu cartera y mantenla alineada con tu plan.</li>
      </ul>
      <p>Te quedan varios días de prueba. Aprovéchalos para dejar todo configurado a tu medida.</p>`,
      'Seguir explorando'
    ),
  };
}

function tplUrgency() {
  return {
    subject: 'Quedan 2 días de tu prueba Pro',
    html: shell(
      'Tu prueba Pro termina en 2 días',
      `<p>Cuando finalice tu prueba, tu cuenta vuelve al plan Free y perderás el acceso a:</p>
      <ul style="padding-left:20px;margin:16px 0;">
        <li style="margin-bottom:8px;">El <strong style="color:#e5e7eb;">Motor de Análisis</strong> completo.</li>
        <li style="margin-bottom:8px;">Seguimiento ilimitado de posiciones (Free te limita a <strong style="color:#e5e7eb;">5 posiciones</strong>).</li>
        <li style="margin-bottom:8px;">Alertas sin tope (Free te limita a <strong style="color:#e5e7eb;">3 alertas</strong>).</li>
        <li style="margin-bottom:8px;">Comparador, Position Builder, screener sin límite e indicadores técnicos.</li>
      </ul>
      <p>Puedes continuar con Pro por <strong style="color:#22c55e;">$199/año</strong>, el equivalente a menos de $17 al mes con el plan anual.</p>`,
      'Activar Pro — $199/año'
    ),
  };
}

function tplLastday() {
  return {
    subject: 'Último día de tu prueba Pro',
    html: shell(
      'Hoy es el último día de tu prueba',
      `<p>Tu prueba Pro termina hoy. Es tu última oportunidad para mantener el acceso a todas las herramientas sin interrupción: Motor de Análisis, Comparador, Position Builder, screener sin límite, indicadores técnicos y rebalanceo.</p>
      <p>Activa Pro ahora y sigue justo donde lo dejaste. Puedes cancelar cuando quieras, sin ataduras.</p>
      <p style="color:#22c55e;font-weight:700;">$199/año — cancela cuando quieras.</p>`,
      'Activar Pro ahora'
    ),
  };
}

const TEMPLATES = {
  welcome: tplWelcome,
  midpoint: tplMidpoint,
  urgency: tplUrgency,
  lastday: tplLastday,
};

export default async function handler(req) {
  // ── Auth: Vercel cron header OR bearer secret ──
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;
  const auth = req.headers.get('authorization') || '';
  const hasSecret = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasSecret) return json({ error: 'Unauthorized' }, 401);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const summary = { processed: 0, sent: 0, skipped: 0, errors: [] };

  // Find all active trial users
  const profiles = await sbFetch(
    'profiles?plan=eq.trial&trial_started_at=not.is.null&select=id,trial_started_at'
  );
  if (!profiles) return json({ error: 'Failed to query profiles' }, 500);

  const now = Date.now();

  for (const p of profiles) {
    summary.processed++;
    try {
      const started = new Date(p.trial_started_at).getTime();
      if (Number.isNaN(started)) { summary.skipped++; continue; }

      const daysElapsed = Math.floor((now - started) / 86400000);
      const templateKey = SCHEDULE[daysElapsed];
      if (!templateKey) { summary.skipped++; continue; }

      // Dedup: already sent this day's email?
      const existing = await sbFetch(
        `trial_emails?user_id=eq.${p.id}&day=eq.${daysElapsed}&select=id`
      );
      if (existing && existing.length > 0) { summary.skipped++; continue; }

      const email = await getUserEmail(p.id);
      if (!email) {
        summary.errors.push({ user_id: p.id, error: 'no_email' });
        continue;
      }

      const { subject, html } = TEMPLATES[templateKey]();
      const result = await sendEmail(email, subject, html);
      if (!result.ok) {
        summary.errors.push({ user_id: p.id, day: daysElapsed, error: result.error });
        continue;
      }

      // Record the send (UNIQUE(user_id, day) is a second dedup layer)
      await sbFetch('trial_emails', 'POST', {
        user_id: p.id,
        day: daysElapsed,
        email_id: result.id,
      });
      summary.sent++;
    } catch (e) {
      summary.errors.push({ user_id: p.id, error: String(e?.message || e) });
    }
  }

  return json(summary);
}
