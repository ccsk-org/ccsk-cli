-- Per-account license binding + payment tracking enhancements.
-- Adds short display transaction ID for VietQR memo matching and bumps pending TTL to 7 days.

ALTER TABLE pending_licenses
  ADD COLUMN IF NOT EXISTS display_txn_id CHAR(6),
  ADD COLUMN IF NOT EXISTS amount_vnd INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'paid', 'issued', 'expired', 'cancelled'));

-- Backfill required_amount → amount_vnd for older rows, then drop the loose default.
UPDATE pending_licenses SET amount_vnd = required_amount WHERE amount_vnd IS NULL;

-- New rows live for 7 days to give operator time for manual reconciliation.
ALTER TABLE pending_licenses
  ALTER COLUMN expires_at SET DEFAULT now() + INTERVAL '7 days';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_display_txn_id
  ON pending_licenses(display_txn_id)
  WHERE display_txn_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_github_username
  ON pending_licenses(github_username);

CREATE INDEX IF NOT EXISTS idx_licenses_github_username
  ON licenses(github_username);
