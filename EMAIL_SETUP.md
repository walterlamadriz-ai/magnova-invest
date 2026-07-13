# Trial Email Nurture Sequence (Fix 11)

Automated emails sent to Pro-trial users on **day 1, 7, 12 and 14** of their
14-day trial, to drive trial → paid conversion.

- **Endpoint:** `api/trial-emails-cron.js` (Vercel Edge Function)
- **Trigger:** Vercel Cron, daily at `0 14 * * *` (14:00 UTC ≈ 10am LATAM) — see `vercel.json`
- **Sender:** Resend REST API, from `FinanceOS Invest <invest@financeospro.com>`
- **Dedup:** `trial_emails` table (one row per user per day-mark)

## 1. Environment variables (set in Vercel → Project → Settings → Environment Variables)

| Variable | Value type | Notes |
|----------|-----------|-------|
| `RESEND_API_KEY` | Resend API key (`re_...`) | From the Resend dashboard → API Keys. Needs send permission. |
| `CRON_SECRET` | Random string | Generate with e.g. `openssl rand -hex 32`. Used to invoke the endpoint manually. |
| `SUPABASE_URL` (or `VITE_SUPABASE_URL`) | Supabase project URL | Already set for the other Edge Functions. |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` key | Already set for the other Edge Functions. |

> Vercel cron invocations are authenticated by the automatic `x-vercel-cron`
> header, so `CRON_SECRET` is only needed for manual testing.

## 2. Verify the Resend domain

In the Resend dashboard, **Domains → add `financeospro.com`** and add the
provided **SPF, DKIM and (optionally) DMARC** DNS records at your DNS provider
(Cloudflare). Emails will not send from `invest@financeospro.com` until the
domain shows **Verified**.

## 3. Run the SQL in Supabase

Open Supabase → SQL Editor and run [`supabase-trial-emails.sql`](./supabase-trial-emails.sql):

```sql
CREATE TABLE IF NOT EXISTS trial_emails (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day INT NOT NULL,
  email_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day)
);
ALTER TABLE trial_emails ENABLE ROW LEVEL SECURITY;
```

## 4. Test manually

After deploying and setting the env vars:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://invest.financeospro.com/api/trial-emails-cron
```

Returns a JSON summary: `{ "processed": N, "sent": M, "skipped": K, "errors": [...] }`.

## How it works

1. Queries `profiles` where `plan = 'trial'` and `trial_started_at IS NOT NULL`.
2. For each user, `daysElapsed = floor((now - trial_started_at) / 86400000)`.
3. Maps the day-mark to a template: 1→welcome, 7→midpoint, 12→urgency, 14→lastday.
4. Skips if a row already exists in `trial_emails` for that `(user_id, day)`.
5. Resolves the email address via the Supabase auth admin API (profiles has no
   email column), sends via Resend, then records the send.
6. Each user is wrapped in try/catch so one failure never aborts the batch.
