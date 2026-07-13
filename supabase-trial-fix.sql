-- ============================================================================
-- FinanceOS Invest — Fix CRITICAL-1: prevenir reset infinito de trial
-- Correr TODO este bloque en Supabase → SQL Editor → Run
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================================

-- 1) Columna trial_used
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- 2) Backfill: marcar como usado todo trial ya iniciado
UPDATE profiles SET trial_used = TRUE WHERE trial_started_at IS NOT NULL;

-- 3) Bloquear escritura de columnas de dinero por el cliente (anon/authenticated).
--    Solo service_role (webhooks de Stripe + /api/check-plan) puede escribirlas.
REVOKE UPDATE (plan, stripe_customer_id, stripe_subscription_id) ON profiles FROM anon, authenticated;

-- 4) Trigger anti-reabuso: una vez que trial_used = TRUE, el cliente ya NO puede
--    volver a false ni re-setear la fecha de inicio para regenerarse otro trial.
--    service_role pasa sin restricción (para cancelaciones/administración).
CREATE OR REPLACE FUNCTION protect_trial_reuse()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role hace bypass (webhooks, endpoints server-side)
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Si el trial ya fue usado, se conservan los valores originales aunque el
  -- cliente intente sobrescribirlos desde la consola.
  IF OLD.trial_used = TRUE THEN
    NEW.trial_used      := TRUE;
    NEW.trial_started_at := OLD.trial_started_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_trial ON profiles;
CREATE TRIGGER trg_protect_trial
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_trial_reuse();
