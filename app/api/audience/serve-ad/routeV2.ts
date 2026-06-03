// app/api/audience/serve-ad/route.ts
// Unified ad server — direct campaigns take priority over network ads
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
  if (!fingerprint) return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  // Get visitor profile
  const { data: profile } = await admin
    .from('audience_profiles')
    .select('city, device_type, interests, page_views')
    .eq('fingerprint', fingerprint)
    .single()

  // Get all active direct ads/campaigns for this position
  // Campaign priority: higher priority number wins
  // Active means: is_active=true, start_date <= today, end_date >= today (or null)
  const { data: ads } = await admin
    .from('direct_ads')
    .select('*')
    .eq('is_active', true)
    .eq('position', position || 'in_content')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('priority', { ascending: false }) // highest priority first

  // No direct campaigns — fall back to network ads
  if (!ads?.length) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  // Match visitor to best ad — score by targeting relevance + priority
  let bestAd = null
  let bestScore = -1

  for (const ad of ads) {
    // Check impression cap
    if (ad.impressions_cap > 0 && (ad.impressions || 0) >= ad.impressions_cap) continue

    // Base score from priority
    let score = (ad.priority || 0) * 10

    // Untargeted campaigns (target_all) are always eligible
    if (ad.target_all) {
      if (score > bestScore) { bestAd = ad; bestScore = score }
      continue
    }

    if (!ad.segment_ids?.length || !profile) continue

    // Get segments and score targeting match
    const { data: segments } = await admin
      .from('audience_segments')
      .select('conditions')
      .in('id', ad.segment_ids)
      .eq('is_active', true)

    for (const seg of segments || []) {
      const c = seg.conditions
      if (c.cities?.length && profile.city && c.cities.includes(profile.city)) score += 3
      if (c.devices?.length && profile.device_type && c.devices.includes(profile.device_type)) score += 2
      if (c.interests?.length && profile.interests?.length) {
        const matches = c.interests.filter((i: string) => profile.interests.includes(i))
        score += matches.length * 2
      }
      if (c.min_page_views && profile.page_views >= c.min_page_views) score += 1
    }

    if (score > bestScore) { bestScore = score; bestAd = ad }
  }

  // No matching direct ad — fall back to network
  if (!bestAd) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  // Log impression asynchronously (don't await — faster response)
  Promise.all([
    admin.from('direct_ad_events').insert({
      ad_id: bestAd.id, fingerprint, event_type: 'impression', site_url,
    }),
    admin.from('direct_ads').update({
      impressions: (bestAd.impressions || 0) + 1,
    }).eq('id', bestAd.id),
  ]).catch(() => {})

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
      campaign_name: bestAd.campaign_name,
    },
    fallback: null,
  }, { headers: CORS })
}
