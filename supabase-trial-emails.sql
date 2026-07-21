-- supabase-trial-emails.sql
-- Tracking table for the trial nurture email sequence (Fix 11).
-- Records each nurture email sent to a trial user so the daily cron never
-- sends the same day's email twice. The cron runs with the service_role key,
-- which bypasses RLS; RLS is enabled with NO policies so anon/authenticated
-- clients cannot read or write this table.

CREATE TABLE IF NOT EXISTS trial_emails (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day INT NOT NULL,
  email_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day)
);

-- Solo service_role accede (el cron corre con service_role). RLS on, sin policies para anon.
ALTER TABLE trial_emails ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Deduplicacion de webhooks de Stripe
-- Stripe entrega cada evento al menos una vez y reintenta ante cualquier fallo.
-- Sin esta tabla, un mismo checkout.session.completed podia emitir dos licencias.
-- La PK actua de cerrojo: el segundo insert falla y el webhook corta.
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id          TEXT PRIMARY KEY,          -- event.id de Stripe (evt_...)
  type        TEXT,
  received_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role (el webhook) accede.
