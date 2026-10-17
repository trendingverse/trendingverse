-- direct_ad_line_items: one campaign (order) → many line items / ad units,
-- each with its own creative. Lets a single campaign serve outstream video
-- and in-banner video creatives from the same budget and targeting config.

CREATE TABLE IF NOT EXISTS direct_ad_line_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id            uuid        NOT NULL REFERENCES direct_ads(id) ON DELETE CASCADE,
  ad_type          text        NOT NULL DEFAULT 'display',
  -- Creative fields (mirrors the campaign-level columns)
  headline         text,
  description      text,
  cta_text         text,
  destination_url  text,
  image_url        text,
  video_url        text,
  video_thumbnail  text,
  -- Status
  is_active        boolean     NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_ad_line_items_ad_id_idx ON direct_ad_line_items(ad_id);
CREATE INDEX IF NOT EXISTS direct_ad_line_items_ad_type_idx ON direct_ad_line_items(ad_type);

-- RLS: admins only (service role bypasses RLS — that's how our API routes work)
ALTER TABLE direct_ad_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON direct_ad_line_items
  USING (true) WITH CHECK (true);
