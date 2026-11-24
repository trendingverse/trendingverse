export const runtime = 'edge'
// app/api/audience/ad-video-event/route.ts
// Accepts video lifecycle events from the WordPress plugin for direct campaigns.
// event_type: 'video_start' | 'video_complete'
// Records into direct_ad_events so VTR / VCR can be computed.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }) }

const ALLOWED_EVENTS = new Set(['video_start', 'video_complete'])

export async function POST(req: NextRequest) {
  const { ad_id, event_type, fingerprint, site_url } = await req.json().catch(() => ({}))
  if (!ad_id || !ALLOWED_EVENTS.has(event_type)) {
    return NextResponse.json({ ok: false, error: 'ad_id and event_type (video_start|video_complete) required' }, { status: 400, headers: CORS })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.from('direct_ad_events').insert({ ad_id, fingerprint, event_type, site_url })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
