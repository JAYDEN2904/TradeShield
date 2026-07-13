-- Optional one-shot apply when drizzle-kit push is unavailable.
-- Adds buyer escrow payment MoMo fields used at pay time.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_momo_number text,
  ADD COLUMN IF NOT EXISTS payment_momo_provider text;
