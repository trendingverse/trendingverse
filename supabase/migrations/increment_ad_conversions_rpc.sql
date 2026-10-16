-- Migration: atomic increment_ad_conversions RPC
-- Run in Supabase SQL Editor or via supabase db push

CREATE OR REPLACE FUNCTION increment_ad_conversions(p_ad_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE direct_ads
  SET conversions = COALESCE(conversions, 0) + 1,
      updated_at  = now()
  WHERE id = p_ad_id;
END;
$$;

-- Grant execute to service_role (used by the pixel API)
GRANT EXECUTE ON FUNCTION increment_ad_conversions(uuid) TO service_role;
