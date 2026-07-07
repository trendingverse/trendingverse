// app/api/audience/serve-ad/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { decideWinner, type DecisionCampaign } from '@/lib/ad-decisioning'

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
  const normalizedSiteUrl = (site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

  // Visitor profile (for targeting match)
  const { data: profile } = await admin
    .from('audience_profiles')
    .select('city, state, country, device_type, interests, page_views')
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  // All active direct ads for this position within flight
  const { data: ads } = await admin
    .from('direct_ads')
    .select('*')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .eq('position', position || 'in_content')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)

  if (!ads?.length) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  // Resolve the placement floor for this site (per-placement CPM gate).
  // Falls back to 0 (no floor) when none is configured.
  let placementFloorCpm = 0
  if (normalizedSiteUrl) {
    const { data: floors } = await admin
      .from('placement_floors')
      .select('floor_cpm_inr, site_url')
    const match = (floors || []).find((f: any) => {
      const fs = (f.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      return fs && (normalizedSiteUrl.includes(fs) || fs.includes(normalizedSiteUrl))
    })
    if (match) placementFloorCpm = match.floor_cpm_inr || 0
  }

  // ── ELIGIBILITY + TARGETING ──────────────────────────────────
  // Build the pool of campaigns that actually MATCH this request
  // (targeting), then let decideWinner() rank by tier → value → weight.
  // Targeting no longer competes with priority — it only decides who is
  // ELIGIBLE, not who wins. This is what protects guaranteed deals.
  const eligible: DecisionCampaign[] = []

  for (const ad of ads) {
    // Impression cap
    if (ad.impressions_cap > 0 && (ad.impressions || 0) >= ad.impressions_cap) continue

    // Site targeting — if campaign targets specific sites, must match
    const targetSites: string[] = (ad.target_site_urls || [])
      .map((s: string) => s.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase())
    if (targetSites.length > 0 && normalizedSiteUrl) {
      const siteMatch = targetSites.some(s => normalizedSiteUrl.includes(s) || s.includes(normalizedSiteUrl))
      if (!siteMatch) continue
    }

    // Audience targeting — target_all campaigns are always eligible.
    // Segment-targeted campaigns must match at least one segment condition.
    let targetingMatches = !!ad.target_all
    if (!targetingMatches && ad.segment_ids?.length && profile) {
      const { data: segments } = await admin
        .from('audience_segments')
        .select('conditions')
        .in('id', ad.segment_ids)
        .eq('is_active', true)

      for (const seg of segments || []) {
        const c = seg.conditions
        const geoMatch =
          (c.countries?.length && profile.country && c.countries.includes(profile.country)) ||
          (c.states?.length && profile.state && c.states.includes(profile.state)) ||
          (c.cities?.length && profile.city && c.cities.includes(profile.city))
        const deviceMatch = c.devices?.length && profile.device_type && c.devices.includes(profile.device_type)
        const interestMatch = c.interests?.length && profile.interests?.length &&
          c.interests.some((i: string) => profile.interests.includes(i))
        const pvMatch = c.min_page_views && profile.page_views >= c.min_page_views

        // A campaign matches if the visitor satisfies its segment.
        // (Any positive signal counts as a match; tune to AND if you
        //  want stricter segment logic.)
        if (geoMatch || deviceMatch || interestMatch || pvMatch) {
          targetingMatches = true
          break
        }
      }
    }

    if (!targetingMatches) continue

    // This campaign is eligible — hand it to the decisioning engine.
    eligible.push({
      id: ad.id,
      campaign_name: ad.campaign_name,
      status: ad.status || (ad.is_active ? 'active' : 'paused'),
      is_active: ad.is_active,
      priority_tier: ad.priority_tier || 2,
      delivery_weight: ad.delivery_weight || 1,
      pricing_model: ad.pricing_model || 'cpm',
      cpm_rate_inr: ad.cpm_rate_inr,
      cpc_rate_inr: ad.cpc_rate_inr,
      flat_fee_inr: ad.flat_fee_inr,
      floor_cpm_inr: ad.floor_cpm_inr,
      start_date: ad.start_date,
      end_date: ad.end_date,
      target_all: ad.target_all,
    })
  }

  // ── DECISION — tier → value → weighted rotation ──────────────
  const winner = decideWinner(eligible, { placementFloorCpm })
  if (!winner) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }

  // Pull the full ad record for the winning campaign to build the response
  const bestAd = ads.find(a => a.id === winner.id)!

  // Log impression (fire-and-forget)
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
