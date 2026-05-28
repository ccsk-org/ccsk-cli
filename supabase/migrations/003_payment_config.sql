-- Editable payment configuration: banks for VietQR + scalar settings (price, etc.)
-- Designed for direct edit via Supabase table editor by operator.

CREATE TABLE IF NOT EXISTS payment_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,                 -- 'Momo', 'Techcombank'
  bin TEXT NOT NULL,                   -- VietQR bank BIN code, e.g. '971025'
  account_number TEXT NOT NULL,        -- bank account or phone (for e-wallets)
  account_name TEXT NOT NULL,          -- holder name
  enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payment_banks"
  ON payment_banks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on app_settings"
  ON app_settings FOR ALL USING (auth.role() = 'service_role');

-- Seed initial banks (values come from user-provided VietQR sample URLs).
INSERT INTO payment_banks (label, bin, account_number, account_name, sort_order)
VALUES
  ('Momo',        '971025', '0915272291',     'DUONG BAC DONG', 1),
  ('Techcombank', '970407', '19034526108011', 'DUONG BAC DONG', 2)
ON CONFLICT DO NOTHING;

-- Seed lifetime price.
INSERT INTO app_settings (key, value, description)
VALUES
  ('lifetime_price_vnd', '265000'::jsonb, 'Lifetime license price in VND for any paid kit')
ON CONFLICT (key) DO NOTHING;
