// app/api/audience/serve-ad/route.ts
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

  // Normalize incoming site_url for matching
  const normalizedSiteUrl = (site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

  // Get visitor profile
  const { data: profile } = await admin
    .from('audience_profiles')
    .select('city, state, country, device_type, interests, page_views')
    .eq('fingerprint', fingerprint)
    .single()

  // Get all active direct ads for this position
  const { data: ads } = await admin
    .from('direct_ads')
    .select('*')
    .eq('is_active', true)
    .eq('position', position || 'in_content')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('priority', { ascending: false })

  if (!ads?.length) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  let bestAd = null
  let bestScore = -1

  for (const ad of ads) {
    // Check impression cap
    if (ad.impressions_cap > 0 && (ad.impressions || 0) >= ad.impressions_cap) continue

    // ── Site targeting check ──────────────────────────────────────────────
    // If campaign has specific target sites, only serve on those sites
    const targetSites: string[] = (ad.target_site_urls || [])
      .map((s: string) => s.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase())

    if (targetSites.length > 0 && normalizedSiteUrl) {
      const siteMatch = targetSites.some(s =>
        normalizedSiteUrl.includes(s) || s.includes(normalizedSiteUrl)
      )
      if (!siteMatch) continue // skip this ad — not for this site
    }
    // ─────────────────────────────────────────────────────────────────────

    // Base score from priority + site-specific bonus
    let score = (ad.priority || 0) * 10
    if (targetSites.length > 0 && normalizedSiteUrl) {
      const exactMatch = targetSites.some(s => s === normalizedSiteUrl)
      score += exactMatch ? 50 : 20 // bonus for site-targeted campaigns
    }

    // Untargeted campaigns (target_all) always eligible
    if (ad.target_all) {
      if (score > bestScore) { bestAd = ad; bestScore = score }
      continue
    }

    if (!ad.segment_ids?.length || !profile) continue

    // Audience segment scoring
    const { data: segments } = await admin
      .from('audience_segments')
      .select('conditions')
      .in('id', ad.segment_ids)
      .eq('is_active', true)

    for (const seg of segments || []) {
      const c = seg.conditions
      if (c.countries?.length && profile.country && c.countries.includes(profile.country)) score += 2
      if (c.states?.length && profile.state && c.states.includes(profile.state)) score += 3
      if (c.cities?.length && profile.city && c.cities.includes(profile.city)) score += 4
      if (c.devices?.length && profile.device_type && c.devices.includes(profile.device_type)) score += 2
      if (c.interests?.length && profile.interests?.length) {
        const matches = c.interests.filter((i: string) => profile.interests.includes(i))
        score += matches.length * 2
      }
      if (c.min_page_views && profile.page_views >= c.min_page_views) score += 1
    }

    if (score > bestScore) { bestScore = score; bestAd = ad }
  }

  if (!bestAd) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  // Log impression
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
      ad_slot_id: bestAd.ad_slot_id,
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
