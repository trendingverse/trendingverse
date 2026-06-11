// app/api/audience/campaign-report/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('id')
  if (!campaignId) return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })

  const { data: campaign } = await admin
    .from('direct_ads').select('*').eq('id', campaignId).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: events } = await admin
    .from('direct_ad_events')
    .select('event_type, created_at, site_url')
    .eq('ad_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(10000)

  const allEvents = events || []
  const impressions = allEvents.filter(e => e.event_type === 'impression').length
  const clicks      = allEvents.filter(e => e.event_type === 'click').length
  const ctr         = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'
  const earned      = campaign.cpm_rate_inr > 0
    ? ((impressions / 1000) * campaign.cpm_rate_inr).toFixed(2)
    : '0'

  // Site breakdown
  const siteMap: Record<string, { impressions: number; clicks: number }> = {}
  for (const e of allEvents) {
    const site = (e.site_url || 'unknown').replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!siteMap[site]) siteMap[site] = { impressions: 0, clicks: 0 }
    if (e.event_type === 'impression') siteMap[site].impressions++
    if (e.event_type === 'click') siteMap[site].clicks++
  }

  // Daily breakdown
  const dayMap: Record<string, { impressions: number; clicks: number }> = {}
  for (const e of allEvents) {
    const day = (e.created_at || '').split('T')[0]
    if (!day) continue
    if (!dayMap[day]) dayMap[day] = { impressions: 0, clicks: 0 }
    if (e.event_type === 'impression') dayMap[day].impressions++
    if (e.event_type === 'click') dayMap[day].clicks++
  }

  const by_site = Object.entries(siteMap).map(([site, d]) => ({
    site, ...d,
    ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00'
  })).sort((a, b) => b.impressions - a.impressions)

  const by_day = Object.entries(dayMap)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Geo breakdown — join with audience_profiles via fingerprint
  const { data: geoEvents } = await admin
    .from('direct_ad_events')
    .select('event_type, fingerprint')
    .eq('ad_id', campaignId)
    .eq('event_type', 'impression')
    .limit(10000)

  const fingerprints = [...new Set((geoEvents || []).map(e => e.fingerprint).filter(Boolean))]

  let by_country: { country: string; impressions: number }[] = []
  let by_state: { state: string; impressions: number }[] = []
  let by_city: { city: string; impressions: number }[] = []

  if (fingerprints.length > 0) {
    const { data: profiles } = await admin
      .from('audience_profiles')
      .select('fingerprint, country, state, city')
      .in('fingerprint', fingerprints.slice(0, 1000))

    const fpMap: Record<string, { country: string; state: string; city: string }> = {}
    for (const p of profiles || []) fpMap[p.fingerprint] = p

    const countryMap: Record<string, number> = {}
    const stateMap: Record<string, number> = {}
    const cityMap: Record<string, number> = {}

    for (const e of geoEvents || []) {
      const p = fpMap[e.fingerprint]
      if (!p) continue
      if (p.country) countryMap[p.country] = (countryMap[p.country] || 0) + 1
      if (p.state)   stateMap[p.state]     = (stateMap[p.state]   || 0) + 1
      if (p.city)    cityMap[p.city]       = (cityMap[p.city]     || 0) + 1
    }

    by_country = Object.entries(countryMap).map(([country, impressions]) => ({ country, impressions })).sort((a, b) => b.impressions - a.impressions).slice(0, 20)
    by_state   = Object.entries(stateMap).map(([state, impressions]) => ({ state, impressions })).sort((a, b) => b.impressions - a.impressions).slice(0, 20)
    by_city    = Object.entries(cityMap).map(([city, impressions]) => ({ city, impressions })).sort((a, b) => b.impressions - a.impressions).slice(0, 20)
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.campaign_name,
      status: campaign.is_active ? 'Active' : 'Paused',
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      priority: campaign.priority,
      cpm_rate_inr: campaign.cpm_rate_inr,
      target_sites: campaign.target_site_urls || [],
      target_countries: campaign.target_countries || [],
      target_gender: campaign.target_gender || 'all',
    },
    summary: { impressions, clicks, ctr, earned_inr: earned },
    by_site,
    by_day,
    by_country,
    by_state,
    by_city,
  }, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaign_id, email } = await req.json()
  if (!campaign_id || !email) return NextResponse.json({ error: 'campaign_id and email required' }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch campaign + events directly (no self-fetch)
  const { data: campaign } = await admin.from('direct_ads').select('*').eq('id', campaign_id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: events } = await admin
    .from('direct_ad_events')
    .select('event_type, created_at, site_url')
    .eq('ad_id', campaign_id)
    .limit(10000)

  const allEvents = events || []
  const impressions = allEvents.filter(e => e.event_type === 'impression').length
  const clicks      = allEvents.filter(e => e.event_type === 'click').length
  const ctr         = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'
  const earned      = campaign.cpm_rate_inr > 0 ? ((impressions / 1000) * campaign.cpm_rate_inr).toFixed(2) : '0'

  const siteMap: Record<string, { impressions: number; clicks: number }> = {}
  for (const e of allEvents) {
    const site = (e.site_url || 'unknown').replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!siteMap[site]) siteMap[site] = { impressions: 0, clicks: 0 }
    if (e.event_type === 'impression') siteMap[site].impressions++
    if (e.event_type === 'click') siteMap[site].clicks++
  }

  const by_site = Object.entries(siteMap).map(([site, d]) => ({
    site, ...d,
    ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00'
  })).sort((a, b) => b.impressions - a.impressions)

  const siteRows = by_site.map(s =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${s.site}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${s.impressions.toLocaleString()}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${s.clicks}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${s.ctr}%</td></tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px}
.stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;display:inline-block;width:22%;margin:0 1%}
table{width:100%;border-collapse:collapse;margin:12px 0}
th{background:#1f2937;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
</style></head><body>
<div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
  <span style="font-size:20px;font-weight:700;color:#fff">Trending<span style="color:#ef4444">Verse</span></span>
  <p style="color:#9ca3af;font-size:12px;margin:4px 0 0">Campaign Performance Report</p>
</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
  <h2 style="font-size:16px;margin:0 0 4px">${campaign.campaign_name}</h2>
  <p style="color:#6b7280;font-size:12px;margin:0 0 20px">Status: <strong>${campaign.is_active ? 'Active' : 'Paused'}</strong> · ${campaign.start_date || 'No start'} → ${campaign.end_date || 'Ongoing'}</p>
  <div style="margin-bottom:24px">
    <div class="stat"><div style="font-size:22px;font-weight:700">${impressions.toLocaleString()}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Impressions</div></div>
    <div class="stat"><div style="font-size:22px;font-weight:700">${clicks}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Clicks</div></div>
    <div class="stat"><div style="font-size:22px;font-weight:700;color:#16a34a">${ctr}%</div><div style="font-size:11px;color:#6b7280;margin-top:4px">CTR</div></div>
    <div class="stat"><div style="font-size:22px;font-weight:700;color:#d97706">₹${earned}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Earned</div></div>
  </div>
  ${by_site.length > 0 ? `<h3 style="font-size:13px;font-weight:600;margin:0 0 8px">Performance by Site</h3>
  <table><tr><th>Site</th><th style="text-align:right">Impressions</th><th style="text-align:right">Clicks</th><th style="text-align:right">CTR</th></tr>${siteRows}</table>` : ''}
  <p style="font-size:11px;color:#9ca3af;margin-top:20px;text-align:center">Generated by TrendingVerse · ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
</div></body></html>`

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'TrendingVerse <noreply@trendingverse.online>',
      to: [email],
      subject: `Campaign Report: ${campaign.campaign_name} — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json()
    return NextResponse.json({ error: err.message || 'Email failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
