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

// Case-insensitive membership test for geo/gender lists
function inList(list: any, val: any): boolean {
  if (!Array.isArray(list) || !list.length) return false
  if (!val) return false
  const v = String(val).trim().toLowerCase()
  return list.some((x: any) => String(x).trim().toLowerCase() === v)
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
    .select('city, state, country, device_type, gender, interests, page_views')
    .eq('fingerprint', fingerprint)
    .maybeSingle()

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

  // Placement floor for this site
  let placementFloorCpm = 0
  if (normalizedSiteUrl) {
    const { data: floors } = await admin.from('placement_floors').select('floor_cpm_inr, site_url')
    const match = (floors || []).find((f: any) => {
      const fs = (f.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      return fs && (normalizedSiteUrl.includes(fs) || fs.includes(normalizedSiteUrl))
    })
    if (match) placementFloorCpm = match.floor_cpm_inr || 0
  }

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

    // ── DIRECT GEO / GENDER TARGETING (the fix) ────────────────
    // These fields come straight from the campaign form. They are HARD
    // filters: if a campaign specifies countries, the visitor's country
    // must be in the list — regardless of target_all. target_all only
    // means "no AD-UNIT restriction", NOT "ignore geo".
    const wantCountries = Array.isArray(ad.target_countries) && ad.target_countries.length > 0
    const wantStates    = Array.isArray(ad.target_states) && ad.target_states.length > 0
    const wantCities    = Array.isArray(ad.target_cities) && ad.target_cities.length > 0
    const wantGender    = ad.target_gender && ad.target_gender !== 'all'

    if (wantCountries && !inList(ad.target_countries, profile?.country)) continue
    if (wantStates && !inList(ad.target_states, profile?.state)) continue
    if (wantCities && !inList(ad.target_cities, profile?.city)) continue
    if (wantGender && String(ad.target_gender).toLowerCase() !== String(profile?.gender || '').toLowerCase()) continue

    // ── AUDIENCE / TARGET-ALL ELIGIBILITY ──────────────────────
    // A campaign is audience-eligible if:
    //  - target_all is true (runs on all inventory), OR
    //  - it has no segments (geo above already governs it), OR
    //  - it matches at least one segment condition.
    let audienceMatches = !!ad.target_all || !ad.segment_ids?.length

    if (!audienceMatches && ad.segment_ids?.length && profile) {
      const { data: segments } = await admin
        .from('audience_segments')
        .select('conditions')
        .in('id', ad.segment_ids)
        .eq('is_active', true)
      for (const seg of segments || []) {
        const c = seg.conditions
        const geoMatch =
          (c.countries?.length && inList(c.countries, profile.country)) ||
          (c.states?.length && inList(c.states, profile.state)) ||
          (c.cities?.length && inList(c.cities, profile.city))
        const deviceMatch = c.devices?.length && inList(c.devices, profile.device_type)
        const interestMatch = c.interests?.length && profile.interests?.length &&
          c.interests.some((i: string) => profile.interests.includes(i))
        const pvMatch = c.min_page_views && profile.page_views >= c.min_page_views
        if (geoMatch || deviceMatch || interestMatch || pvMatch) { audienceMatches = true; break }
      }
    }
    if (!audienceMatches) continue

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

  const winner = decideWinner(eligible, { placementFloorCpm })
  if (!winner) {
    return NextResponse.json({ ad: null, fallback: 'network' }, { headers: CORS })
  }
  const bestAd = ads.find(a => a.id === winner.id)!

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
