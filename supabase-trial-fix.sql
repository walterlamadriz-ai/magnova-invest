-- Fix CRITICAL-1: trial_used column to prevent infinite trial reset
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- Backfill: mark all existing trial_started_at rows as used
UPDATE profiles SET trial_used = TRUE WHERE trial_started_at IS NOT NULL;

-- RLS: Only service_role can write trial_used, plan, stripe columns
-- (Run these only if not already set)
CREATE POLICY IF NOT EXISTS "anon cannot write plan" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    plan IS NOT DISTINCT FROM (SELECT plan FROM profiles WHERE id = auth.uid()) AND
    trial_used IS NOT DISTINCT FROM (SELECT trial_used FROM profiles WHERE id = auth.uid()) AND
    stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM profiles WHERE id = auth.uid()) AND
    stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM profiles WHERE id = auth.uid())
  );
