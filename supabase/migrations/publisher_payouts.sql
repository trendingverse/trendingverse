-- Publisher monthly revenue / payout tracker
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS publisher_payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id TEXT NOT NULL,           -- references publishers_db.id
  month       TEXT NOT NULL,            -- format: 'YYYY-MM'
  amount_inr  NUMERIC NOT NULL CHECK (amount_inr >= 0),
  notes       TEXT,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (publisher_id, month)          -- one record per publisher per month; upsert-safe
);

CREATE INDEX IF NOT EXISTS idx_publisher_payouts_publisher_id ON publisher_payouts (publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_payouts_month ON publisher_payouts (month);

-- RLS: only service role can read/write (API uses service role key)
ALTER TABLE publisher_payouts ENABLE ROW LEVEL SECURITY;
