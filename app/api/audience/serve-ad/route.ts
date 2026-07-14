// app/api/audience/ad-impression/route.ts
// Logs a HOUSE ad impression — called by the plugin ONLY when a house
// filler actually renders (i.e. network didn't fill). Keeps house
// impression counts honest under the house-last waterfall.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}
export async function POST(req: NextRequest) {
  const { ad_id, fingerprint, site_url } = await req.json().catch(() => ({}))
  if (!ad_id) return NextResponse.json({ ok: false }, { headers: CORS })
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // fetch current count to increment
  const { data: ad } = await admin.from('direct_ads').select('impressions').eq('id', ad_id).maybeSingle()
  await Promise.all([
    admin.from('direct_ad_events').insert({ ad_id, fingerprint, event_type: 'impression', site_url }),
    admin.from('direct_ads').update({ impressions: (ad?.impressions || 0) + 1 }).eq('id', ad_id),
  ]).catch(() => {})
  return NextResponse.json({ ok: true }, { headers: CORS })
}
