// app/api/audience/ad-viewable/route.ts
// Records a viewability event (MRC: >=50% in view for >=1s). Mirrors the
// ad-click endpoint's pattern. Deduped per fingerprint+ad+page-load on the
// client, so this just records what the client already validated.
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

  // Log the viewable event + increment the campaign's viewable counter.
  // Read-modify-write on the counter is fine at this scale; if contention
  // ever matters, move to a SQL increment via rpc.
  const { data: current } = await admin
    .from('direct_ads')
    .select('viewable_impressions')
    .eq('id', ad_id)
    .maybeSingle()

  await Promise.all([
    admin.from('direct_ad_events').insert({
      ad_id, fingerprint, event_type: 'viewable', site_url,
    }),
    admin.from('direct_ads').update({
      viewable_impressions: (current?.viewable_impressions || 0) + 1,
    }).eq('id', ad_id),
  ]).catch(() => {})

  return NextResponse.json({ ok: true }, { headers: CORS })
}
