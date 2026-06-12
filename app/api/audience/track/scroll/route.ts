// app/api/audience/track/scroll/route.ts
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
  const { fingerprint, site_url, page_url, scroll_depth } = await req.json().catch(() => ({}))
  if (!fingerprint || scroll_depth === undefined) {
    return NextResponse.json({ ok: false }, { headers: CORS })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Upsert — keep max scroll depth per fingerprint per page
  await admin.from('scroll_events').upsert({
    fingerprint,
    site_url,
    page_url: page_url || site_url,
    scroll_depth: Math.min(100, Math.max(0, Math.round(scroll_depth))),
  }, {
    onConflict: 'fingerprint,page_url',
    ignoreDuplicates: false,
  }).then(async () => {
    // Also update audience_profiles with latest scroll depth
    await admin.from('audience_profiles')
      .update({ scroll_depth })
      .eq('fingerprint', fingerprint)
  }).catch(() => {})

  return NextResponse.json({ ok: true }, { headers: CORS })
}
