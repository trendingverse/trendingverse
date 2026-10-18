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

// Real-time IP geo lookup — fallback for new visitors whose profile
// doesn't exist yet (serve-ad and track fire concurrently on first load)
async function geoFromIp(ip: string): Promise<{ city: string; state: string; country: string }> {
  try {
    if (!ip || ip === '::1' || ip === '127.0.0.1') return { city: '', state: '', country: '' }
    const res = await fetch(`https://ipwho.is/${ip}?fields=city,region,country`, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    if (data?.success !== false) return { city: data.city || '', state: data.region || '', country: data.country || '' }
  } catch { /* fall through */ }
  return { city: '', state: '', country: '' }
}

export async function GET(req: NextRequest) {
  // Debug endpoint: GET /api/audience/serve-ad?site_url=...&position=...
  // Returns which campaigns are in DB and why each passes/fails eligibility
  const { searchParams } = new URL(req.url)
  const site_url = searchParams.get('site_url') || ''
  const position = searchParams.get('position') || 'in_content'
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const today = new Date().toISOString().split('T')[0]
  const pos = position
  const normalizedSiteUrl = site_url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

  const { data: allAds, error: allErr } = await admin.from('direct_ads').select('id,campaign_name,is_active,approval_status,position,start_date,end_date,impressions_cap,impressions,target_site_urls,target_all,segment_ids,target_countries,target_states,target_cities,target_gender,status,pricing_model,cpm_rate_inr,floor_cpm_inr')
  const { data: filtAds, error: filtErr } = await admin
    .from('direct_ads')
    .select('id,campaign_name,is_active,approval_status,position,start_date,end_date,impressions_cap,impressions,target_site_urls,target_all,segment_ids')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .or(`position.is.null,position.eq.${pos}`)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)

  const diagnostics = (allAds || []).map((ad: any) => {
    const checks: Record<string, boolean | string> = {}
    checks['is_active'] = ad.is_active
    checks['approval_status'] = ad.approval_status
    checks['position_ok'] = !ad.position || ad.position === pos ? true : `position=${ad.position} vs req=${pos}`
    checks['start_date_ok'] = !ad.start_date || ad.start_date <= today ? true : `start=${ad.start_date} > today=${today}`
    checks['end_date_ok'] = !ad.end_date || ad.end_date >= today ? true : `end=${ad.end_date} < today=${today}`
    checks['impressions_cap_ok'] = ad.impressions_cap <= 0 || (ad.impressions || 0) < ad.impressions_cap ? true : `cap=${ad.impressions_cap} hit (${ad.impressions})`
    const targetSites = (ad.target_site_urls || []).map((s: string) => s.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase())
    if (targetSites.length > 0 && normalizedSiteUrl) {
      const siteMatch = targetSites.some((s: string) => normalizedSiteUrl.includes(s) || s.includes(normalizedSiteUrl))
      checks['site_targeting'] = siteMatch ? true : `NO MATCH: sites=${JSON.stringify(targetSites)} vs req=${normalizedSiteUrl}`
    } else {
      checks['site_targeting'] = `PASS (targetSites=${JSON.stringify(targetSites)}, reqSite=${normalizedSiteUrl})`
    }
    checks['audience'] = !!ad.target_all ? 'PASS (target_all=true)' : (!ad.segment_ids?.length ? 'PASS (no segments)' : `needs segment match (${ad.segment_ids?.length} segs)`)
    // decideWinner.isEligible checks
    const resolvedStatus = ad.status || (ad.is_active ? 'active' : 'paused')
    checks['status_for_decisioning'] = resolvedStatus
    checks['decisioning_status_ok'] = !['paused','completed','draft'].includes(resolvedStatus) ? true : `BLOCKED: status=${resolvedStatus}`
    checks['pricing_model'] = ad.pricing_model || 'cpm (default)'
    checks['cpm_rate_inr'] = ad.cpm_rate_inr ?? 0
    checks['floor_cpm_inr'] = ad.floor_cpm_inr ?? 0
    if ((ad.pricing_model || 'cpm') === 'cpm') {
      const floor = Math.max(0, ad.floor_cpm_inr || 0)
      checks['floor_gate'] = floor > 0 && (ad.cpm_rate_inr || 0) < floor ? `BLOCKED: cpm=${ad.cpm_rate_inr} < floor=${floor}` : `PASS (floor=${floor})`
    }
    const passesAll = ad.is_active && ad.approval_status === 'approved' &&
      (checks['position_ok'] === true) && (checks['start_date_ok'] === true) &&
      (checks['end_date_ok'] === true) && (checks['impressions_cap_ok'] === true) &&
      (checks['site_targeting'] === true || String(checks['site_targeting']).startsWith('PASS'))
    return { id: ad.id, campaign_name: ad.campaign_name, passes: passesAll, checks }
  })

  return NextResponse.json({
    today,
    pos,
    normalizedSiteUrl,
    total_campaigns: allAds?.length || 0,
    db_filtered_count: filtAds?.length || 0,
    db_filter_error: filtErr?.message || null,
    diagnostics,
  }, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const { fingerprint, site_url, position, ad_type: requested_ad_type } = await req.json().catch(() => ({}))
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

  // New visitor — profile not written yet (track and serve-ad fire concurrently).
  // Do a real-time IP geo lookup so geo-targeted ads can still match on first visit.
  let geoFallback = { city: '', state: '', country: '' }
  if (!profile) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || ''
    geoFallback = await geoFromIp(ip)
  }

  // Resolved geo — prefer stored profile, fall back to live IP lookup
  const visitorGeo = {
    city:    profile?.city    || geoFallback.city,
    state:   profile?.state   || geoFallback.state,
    country: profile?.country || geoFallback.country,
  }

  const pos = position || 'in_content'
  const { data: ads } = await admin
    .from('direct_ads')
    .select('*')
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .or(`position.is.null,position.eq.${pos}`)
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

    if (wantCountries && !inList(ad.target_countries, visitorGeo.country)) continue
    if (wantStates    && !inList(ad.target_states,   visitorGeo.state))   continue
    if (wantCities    && !inList(ad.target_cities,   visitorGeo.city))    continue
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

  // Check for a line item that matches the requested ad_type.
  // If the plugin passes ad_type (e.g. "outstream", "inbanner_video"), we pick
  // the matching line item's creative; otherwise fall back to campaign-level fields.
  let lineItemCreative: {
    ad_type: string; headline: string | null; description: string | null
    image_url: string | null; cta_text: string | null; destination_url: string | null
    video_url: string | null; video_thumbnail: string | null
  } | null = null

  if (requested_ad_type) {
    const { data: lineItems } = await admin
      .from('direct_ad_line_items')
      .select('ad_type,headline,description,image_url,cta_text,destination_url,video_url,video_thumbnail')
      .eq('ad_id', bestAd.id)
      .eq('is_active', true)
    const match = (lineItems || []).find((li: any) => li.ad_type === requested_ad_type)
    if (match) lineItemCreative = match
  }

  const creative = lineItemCreative ?? {
    ad_type:         bestAd.ad_type,
    headline:        bestAd.headline,
    description:     bestAd.description,
    image_url:       bestAd.image_url,
    cta_text:        bestAd.cta_text,
    destination_url: bestAd.destination_url,
    video_url:       bestAd.video_url || null,
    video_thumbnail: bestAd.video_thumbnail || null,
  }

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
      ad_type: creative.ad_type,
      ad_slot_id: bestAd.ad_slot_id,
      headline: creative.headline,
      description: creative.description,
      image_url: creative.image_url,
      cta_text: creative.cta_text,
      destination_url: creative.destination_url,
      size_width: bestAd.size_width,
      size_height: bestAd.size_height,
      campaign_name: bestAd.campaign_name,
      video_url: creative.video_url,
      video_thumbnail: creative.video_thumbnail,
      has_line_items: !!lineItemCreative,
    },
    fallback: null,
  }, { headers: CORS })
}
