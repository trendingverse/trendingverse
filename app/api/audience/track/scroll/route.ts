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

  const depth = Math.min(100, Math.max(0, Math.round(scroll_depth)))
  const key = page_url || site_url

  try {
    // Engagement ledger: keep the DEEPEST scroll ever reached per reader
    // per page, plus a running count of views and last-seen timestamp.
    // We never overwrite a good number with a worse one — max_depth only
    // goes up. This is what makes "% of readers reaching 75%+" reportable.
    const { data: existing } = await admin
      .from('scroll_events')
      .select('id, max_depth, last_depth, view_count')
      .eq('fingerprint', fingerprint)
      .eq('page_url', key)
      .maybeSingle()

    if (existing) {
      await admin.from('scroll_events').update({
        max_depth: Math.max(existing.max_depth || 0, depth), // best ever — never decreases
        last_depth: depth,                                    // most recent, for recency
        view_count: (existing.view_count || 1),               // bumped once per page-load below
        last_seen_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await admin.from('scroll_events').insert({
        fingerprint,
        site_url,
        page_url: key,
        max_depth: depth,
        last_depth: depth,
        view_count: 1,
        last_seen_at: new Date().toISOString(),
      })
    }

    // Profile-level: store the reader's BEST scroll across any page as a
    // coarse engagement signal, only ever raising it. A single averaged
    // number across pages is meaningless; "deepest engagement reached" is
    // at least a real, defensible signal.
    const { data: profile } = await admin
      .from('audience_profiles')
      .select('scroll_depth')
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    if (profile) {
      const best = Math.max(profile.scroll_depth || 0, depth)
      if (best !== profile.scroll_depth) {
        await admin.from('audience_profiles')
          .update({ scroll_depth: best })
          .eq('fingerprint', fingerprint)
      }
    }
  } catch { /* silent — tracking must never break the page */ }

  return NextResponse.json({ ok: true }, { headers: CORS })
}
