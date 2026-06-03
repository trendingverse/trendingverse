// app/api/audience/ad-click/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }) }

export async function POST(req: NextRequest) {
  const { ad_id, fingerprint, site_url } = await req.json().catch(() => ({}))
  if (!ad_id) return NextResponse.json({ ok: false }, { headers: CORS })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  await Promise.all([
    admin.from('direct_ad_events').insert({ ad_id, fingerprint, event_type: 'click', site_url }),
    admin.from('direct_ads').select('clicks').eq('id', ad_id).single().then(({ data }) =>
      admin.from('direct_ads').update({ clicks: (data?.clicks || 0) + 1 }).eq('id', ad_id)
    ),
  ])

  return NextResponse.json({ ok: true }, { headers: CORS })
}
