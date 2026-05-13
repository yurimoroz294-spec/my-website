-- Add Stripe billing fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Index for webhook lookups by customer ID
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Monthly reset: clear invoices_this_month on the 1st of each month
-- Schedule with Supabase pg_cron or Vercel Cron calling /api/cron/reset-counts
-- (pg_cron version shown here — enable via Supabase dashboard → Database → Extensions)
-- SELECT cron.schedule('reset-invoice-counts', '0 0 1 * *', $$
--   UPDATE profiles SET invoices_this_month = 0;
-- $$);
