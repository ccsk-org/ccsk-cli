-- Migration: installs and donations tables for single-kit architecture
-- Replaces license-gated access with install tracking + donation support

-- Track installations (who installed the kit)
CREATE TABLE IF NOT EXISTS installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_username TEXT,
  email TEXT,
  kit_version TEXT,
  installed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installs_github ON installs(github_username);
CREATE INDEX IF NOT EXISTS idx_installs_email ON installs(email);
CREATE INDEX IF NOT EXISTS idx_installs_installed_at ON installs(installed_at);

-- Track donations (who donated via VietQR)
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,           -- 'coffee', 'bubble_tea', 'latte', 'brunch'
  amount_usd INTEGER NOT NULL,  -- 2, 5, 10, 25
  amount_vnd INTEGER NOT NULL,
  email TEXT,                   -- optional, for thank-you note
  memo TEXT,                    -- VietQR memo for reconciliation
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'thanked'
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  thanked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(email);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);

-- View for pending donations to reconcile with bank statements
CREATE OR REPLACE VIEW pending_donations_to_reconcile AS
SELECT
  id,
  tier,
  amount_vnd,
  email,
  memo,
  created_at
FROM donations
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Function to confirm a donation after payment verification
CREATE OR REPLACE FUNCTION confirm_donation(donation_memo TEXT)
RETURNS TABLE(id UUID, tier TEXT, email TEXT, amount_vnd INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE donations d
  SET status = 'confirmed', confirmed_at = now()
  WHERE d.memo = donation_memo AND d.status = 'pending'
  RETURNING d.id, d.tier, d.email, d.amount_vnd;
END;
$$ LANGUAGE plpgsql;

-- Function to mark donation as thanked (after sending thank-you email)
CREATE OR REPLACE FUNCTION mark_donation_thanked(donation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE donations
  SET status = 'thanked', thanked_at = now()
  WHERE id = donation_id AND status = 'confirmed';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for install statistics
CREATE OR REPLACE VIEW install_stats AS
SELECT
  COUNT(*) AS total_installs,
  COUNT(DISTINCT github_username) AS unique_github_users,
  COUNT(DISTINCT email) AS unique_emails,
  COUNT(*) FILTER (WHERE installed_at > now() - INTERVAL '7 days') AS last_7_days,
  COUNT(*) FILTER (WHERE installed_at > now() - INTERVAL '30 days') AS last_30_days
FROM installs;

-- View for donation statistics
CREATE OR REPLACE VIEW donation_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'confirmed' OR status = 'thanked') AS total_confirmed,
  COALESCE(SUM(amount_usd) FILTER (WHERE status = 'confirmed' OR status = 'thanked'), 0) AS total_usd,
  COALESCE(SUM(amount_vnd) FILTER (WHERE status = 'confirmed' OR status = 'thanked'), 0) AS total_vnd,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
FROM donations;
