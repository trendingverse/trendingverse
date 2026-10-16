-- Per-campaign activity log / event timeline
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS direct_ad_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id       UUID NOT NULL REFERENCES direct_ads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,            -- 'note' | 'approved' | 'rejected' | 'activated' | 'paused' | 'completed' | 'created'
  description TEXT NOT NULL,
  metadata    JSONB,                    -- optional structured data (e.g. approval_note, old/new status)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT                      -- admin email or 'system'
);

CREATE INDEX IF NOT EXISTS idx_direct_ad_events_ad_id ON direct_ad_events (ad_id);
CREATE INDEX IF NOT EXISTS idx_direct_ad_events_created_at ON direct_ad_events (created_at DESC);

-- RLS: only service role can read/write (API uses service role key)
ALTER TABLE direct_ad_events ENABLE ROW LEVEL SECURITY;
