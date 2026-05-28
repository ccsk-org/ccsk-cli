-- License system schema for per-kit entitlements

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  email TEXT,
  github_username TEXT,
  user_hash TEXT,
  kit_entitlements TEXT[] DEFAULT ARRAY['common'],
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_user_hash ON licenses(user_hash);
CREATE INDEX idx_licenses_email ON licenses(email);

-- Pending licenses for payment tracking
CREATE TABLE IF NOT EXISTS pending_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_hash TEXT NOT NULL,
  email TEXT,
  github_username TEXT,
  kit TEXT NOT NULL,
  required_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '1 hour'
);

CREATE INDEX idx_pending_user_hash ON pending_licenses(user_hash);

-- RLS policies
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_licenses ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on licenses"
  ON licenses FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on pending_licenses"
  ON pending_licenses FOR ALL
  USING (auth.role() = 'service_role');
