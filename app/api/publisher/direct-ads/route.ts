export const runtime = 'edge'
// app/api/publisher/direct-ads/route.ts
// GET — returns direct ad campaigns targeting this publisher's sites,
//        with per-campaign impressions, clicks/video events, and estimated INR earnings.
// ?campaign_id=&breakdown=daily → returns day-wise breakdown for one campaign.
// Auth required; non-admins are locked to their own sites.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get publisher's sites
  const { data: sites } = await admin
    .from('sites')
    .select('id, site_url, name')
    .eq('user_id', user.id)

  const siteUrls = (sites || []).map(s => {
    const u = s.site_url || ''
    return u.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
  }).filter(Boolean)

  if (siteUrls.length === 0) {
    return NextResponse.json({ campaigns: [], sites: [] })
  }

  // ── Daily breakdown for a single campaign ────────────────────────────────
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const breakdown  = req.nextUrl.searchParams.get('breakdown')
  if (campaignId && breakdown === 'daily') {
    // Verify this campaign targets the publisher's site before returning data
    const { data: camp } = await admin
      .from('direct_ads')
      .select('id, campaign_name, ad_type, target_site_urls')
      .eq('id', campaignId)
      .single()
    if (!camp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const targets = (camp.target_site_urls || []).map((u: string) =>
      u.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    )
    const allowed = targets.length === 0
      ? false
      : targets.some((t: string) => siteUrls.some(s => s === t || s.includes(t) || t.includes(s)))
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all events for this campaign
    const isVideo = ['inbanner_video', 'outstream'].includes(camp.ad_type || '')
    const eventTypes = isVideo
      ? ['impression', 'video_start', 'video_complete']
      : ['impression', 'click']

    const dayMap: Record<string, { impressions: number; clicks: number; video_views: number; video_completions: number }> = {}
    let page = 0
    while (true) {
      const { data: batch } = await admin
        .from('direct_ad_events')
        .select('event_type, created_at')
        .eq('ad_id', campaignId)
        .in('event_type', eventTypes)
        .range(page * 1000, (page + 1) * 1000 - 1)
        .order('created_at', { ascending: true })
      if (!batch || batch.length === 0) break
      for (const e of batch) {
        const day = (e.created_at || '').slice(0, 10)
        if (!day) continue
        if (!dayMap[day]) dayMap[day] = { impressions: 0, clicks: 0, video_views: 0, video_completions: 0 }
        if (e.event_type === 'impression')      dayMap[day].impressions++
        if (e.event_type === 'click')           dayMap[day].clicks++
        if (e.event_type === 'video_start')     dayMap[day].video_views++
        if (e.event_type === 'video_complete')  dayMap[day].video_completions++
      }
      if (batch.length < 1000) break
      page++
      if (page > 50) break
    }

    const by_day = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        impressions: d.impressions,
        clicks: d.clicks,
        video_views: d.video_views,
        video_completions: d.video_completions,
        vtr: d.impressions > 0 ? +((d.video_views / d.impressions) * 100).toFixed(2) : 0,
        vcr: d.impressions > 0 ? +((d.video_completions / d.impressions) * 100).toFixed(2) : 0,
        ctr: d.impressions > 0 ? +((d.clicks / d.impressions) * 100).toFixed(2) : 0,
      }))

    return NextResponse.json({ by_day, ad_type: camp.ad_type, campaign_name: camp.campaign_name })
  }

  // ── Full campaign list ────────────────────────────────────────────────────
  const { data: allCampaigns } = await admin
    .from('direct_ads')
    .select('id, campaign_name, headline, description, approval_status, is_active, start_date, end_date, cpm_rate_inr, impressions, target_site_urls, created_at, ad_type')
    .in('approval_status', ['approved', 'active', 'activated'])
    .order('created_at', { ascending: false })
    .limit(500)

  // Filter client-side to campaigns whose target_site_urls intersects with publisher's sites
  const campaigns = (allCampaigns || []).filter(c => {
    const targets = (c.target_site_urls || []).map((u: string) =>
      u.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    )
    return targets.length === 0
      ? false
      : targets.some((t: string) => siteUrls.some(s => s === t || s.includes(t) || t.includes(s)))
  })

  if (campaigns.length === 0) {
    return NextResponse.json({ campaigns: [], sites: sites || [] })
  }

  const campaignIds = campaigns.map(c => c.id)

  // Batch fetch event counts per campaign — clicks for display, video events for video
  const eventCounts: Record<string, { clicks: number; video_views: number; video_completions: number }> = {}
  for (const id of campaignIds) {
    let clicks = 0, video_views = 0, video_completions = 0, page = 0
    while (true) {
      const { data: batch } = await admin
        .from('direct_ad_events')
        .select('event_type')
        .eq('ad_id', id)
        .in('event_type', ['click', 'video_start', 'video_complete'])
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      for (const e of batch) {
        if (e.event_type === 'click')          clicks++
        if (e.event_type === 'video_start')    video_views++
        if (e.event_type === 'video_complete') video_completions++
      }
      if (batch.length < 1000) break
      page++
      if (page > 20) break
    }
    eventCounts[id] = { clicks, video_views, video_completions }
  }

  const enriched = campaigns.map(c => {
    const impressions = Number(c.impressions || 0)
    const ev = eventCounts[c.id] || { clicks: 0, video_views: 0, video_completions: 0 }
    const isVideo = ['inbanner_video', 'outstream'].includes(c.ad_type || '')
    const ctr  = impressions > 0 ? +((ev.clicks / impressions) * 100).toFixed(2) : 0
    const vtr  = impressions > 0 ? +((ev.video_views / impressions) * 100).toFixed(2) : 0
    const vcr  = impressions > 0 ? +((ev.video_completions / impressions) * 100).toFixed(2) : 0
    const earned_inr = c.cpm_rate_inr > 0 ? +((impressions / 1000) * c.cpm_rate_inr).toFixed(2) : 0
    return {
      id: c.id,
      campaign_name: c.campaign_name,
      headline: c.headline,
      ad_type: c.ad_type || 'display',
      is_video: isVideo,
      approval_status: c.approval_status,
      is_active: c.is_active,
      start_date: c.start_date,
      end_date: c.end_date,
      cpm_rate_inr: c.cpm_rate_inr,
      target_site_urls: c.target_site_urls || [],
      created_at: c.created_at,
      impressions,
      clicks: ev.clicks,
      video_views: ev.video_views,
      video_completions: ev.video_completions,
      ctr,
      vtr,
      vcr,
      earned_inr,
    }
  })

  return NextResponse.json({ campaigns: enriched, sites: sites || [] })
}
