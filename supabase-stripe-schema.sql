-- FinanceOS Stripe integration schema
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/nelwgbcddwiaimzbcuas/sql

-- 1. Licenses table (FinanceOS App one-time purchases)
create table if not exists licenses (
  id                 uuid primary key default gen_random_uuid(),
  key                text unique not null,           -- FNOS-XXXX-XXXX-XXXX
  plan               text not null check (plan in ('personal', 'pro')),
  stripe_session_id  text unique,
  customer_email     text,
  stripe_amount      int,                            -- cents
  activations        int default 0,
  created_at         timestamptz default now(),
  last_activated_at  timestamptz
);

-- RLS: only service_role can read/write (no public access)
alter table licenses enable row level security;
-- No policies needed — service_role bypasses RLS by default

-- Index for fast lookup by session_id (used in get-license.js)
create index if not exists idx_licenses_session on licenses (stripe_session_id);

-- 2. Add Stripe columns to profiles table (FinanceOS Invest)
alter table profiles
  add column if not exists stripe_customer_id      text,
  add column if not exists stripe_subscription_id  text;

create index if not exists idx_profiles_stripe_customer on profiles (stripe_customer_id);

-- 3. Function to validate a license key (called by licenseValidator)
-- Returns: { valid, plan, activations } or null
create or replace function validate_license(p_key text)
returns jsonb
language plpgsql security definer
as $$
declare
  rec licenses%rowtype;
begin
  select * into rec from licenses where key = p_key;
  if not found then
    return jsonb_build_object('valid', false);
  end if;
  -- Increment activation counter
  update licenses set activations = activations + 1, last_activated_at = now()
  where id = rec.id;
  return jsonb_build_object('valid', true, 'plan', rec.plan, 'activations', rec.activations + 1);
end;
$$;

-- Grant execute to anon (called from frontend via Edge Function)
grant execute on function validate_license(text) to anon;
