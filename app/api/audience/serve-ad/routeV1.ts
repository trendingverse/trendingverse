// app/api/audience/serve-ad/route.ts
// Called by tv-tracker.js to get targeted ad for this visitor
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
  const { fingerprint, site_url, position } = await req.json().catch(() => ({}))
  if (!fingerprint) return NextResponse.json({ ad: null }, { headers: CORS })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get visitor profile
  const { data: profile } = await admin
    .from('audience_profiles')
    .select('city, device_type, interests, page_views')
    .eq('fingerprint', fingerprint)
    .single()

  // Get all active direct ads for this position
  const { data: ads } = await admin
    .from('direct_ads')
    .select('*')
    .eq('is_active', true)
    .eq('position', position || 'in_content')
    .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)

  if (!ads?.length) return NextResponse.json({ ad: null }, { headers: CORS })

  // Match visitor to best ad
  let bestAd = null
  let bestScore = -1

  for (const ad of ads) {
    // Untargeted ads always eligible
    if (ad.target_all) {
      if (bestScore < 0) { bestAd = ad; bestScore = 0 }
      continue
    }

    if (!ad.segment_ids?.length || !profile) continue

    // Get segments for this ad
    const { data: segments } = await admin
      .from('audience_segments')
      .select('conditions')
      .in('id', ad.segment_ids)
      .eq('is_active', true)

    let score = 0
    for (const seg of segments || []) {
      const c = seg.conditions
      // City match
      if (c.cities?.length && profile.city && c.cities.includes(profile.city)) score += 3
      // Device match
      if (c.devices?.length && profile.device_type && c.devices.includes(profile.device_type)) score += 2
      // Interest match
      if (c.interests?.length && profile.interests?.length) {
        const matches = c.interests.filter((i: string) => profile.interests.includes(i))
        score += matches.length * 2
      }
      // Engagement match
      if (c.min_page_views && profile.page_views >= c.min_page_views) score += 1
    }

    if (score > bestScore) { bestScore = score; bestAd = ad }
  }

  if (!bestAd) return NextResponse.json({ ad: null }, { headers: CORS })

  // Log impression
  await admin.from('direct_ad_events').insert({
    ad_id: bestAd.id,
    fingerprint,
    event_type: 'impression',
    site_url,
  })

  // Increment impression count
  await admin.from('direct_ads').update({ impressions: (bestAd.impressions || 0) + 1 }).eq('id', bestAd.id)

  return NextResponse.json({
    ad: {
      id: bestAd.id,
      ad_type: bestAd.ad_type,
      headline: bestAd.headline,
      description: bestAd.description,
      image_url: bestAd.image_url,
      cta_text: bestAd.cta_text,
      destination_url: bestAd.destination_url,
      size_width: bestAd.size_width,
      size_height: bestAd.size_height,
    }
  }, { headers: CORS })
}
