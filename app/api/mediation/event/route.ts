// app/api/mediation/event/route.ts
// Records mediation events (fill / nofill / click / viewable) from the
// universal tag. This is the raw data Phase 2 aggregates into per-partner
// eCPM — the fuel for the Phase 3 optimisation algorithm.
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
  const b = await req.json().catch(() => ({}))
  if (!b.event_type) return NextResponse.json({ ok: false }, { headers: CORS })
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  admin.from('mediation_events').insert({
    fingerprint: b.fingerprint || null,
    site_url: (b.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(),
    position: b.position || null,
    partner_slug: b.partner_slug || null,
    event_type: b.event_type,
  }).then(() => {}, () => {})
  return NextResponse.json({ ok: true }, { headers: CORS })
}
