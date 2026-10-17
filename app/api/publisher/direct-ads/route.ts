// app/api/publisher/direct-ads/route.ts
// GET — returns direct ad campaigns targeting this publisher's sites,
//        along with per-campaign impressions, clicks, CTR, and estimated INR earnings.
// Auth required; non-admins are locked to their own sites.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
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

  // Find active direct campaigns targeting any of the publisher's sites.
  // target_site_urls is a text[] column — use overlaps (&&) on normalized URLs.
  // We also include approved/active campaigns.
  const { data: allCampaigns } = await admin
    .from('direct_ads')
    .select('id, campaign_name, headline, description, approval_status, is_active, start_date, end_date, cpm_rate_inr, impressions, target_site_urls, created_at')
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

  // Aggregate clicks per campaign from direct_ad_events (events table has impressions & clicks)
  // impressions are already on direct_ads.impressions column; we need click counts.
  const campaignIds = campaigns.map(c => c.id)

  // Batch fetch click counts — one query per campaign is too slow for many campaigns.
  // Use a manual count via paginated events for each campaign id.
  // For up to ~20 campaigns this is fine; for larger sets the RPC is better.
  const clickCounts: Record<string, number> = {}
  for (const id of campaignIds) {
    let clicks = 0, page = 0
    while (true) {
      const { data: batch } = await admin
        .from('direct_ad_events')
        .select('event_type')
        .eq('ad_id', id)
        .eq('event_type', 'click')
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      clicks += batch.length
      if (batch.length < 1000) break
      page++
      if (page > 20) break // safety: cap at 20k clicks per campaign
    }
    clickCounts[id] = clicks
  }

  const enriched = campaigns.map(c => {
    const impressions = Number(c.impressions || 0)
    const clicks = clickCounts[c.id] || 0
    const ctr = impressions > 0 ? +((clicks / impressions) * 100).toFixed(2) : 0
    const earned_inr = c.cpm_rate_inr > 0 ? +((impressions / 1000) * c.cpm_rate_inr).toFixed(2) : 0
    return {
      id: c.id,
      campaign_name: c.campaign_name,
      headline: c.headline,
      approval_status: c.approval_status,
      is_active: c.is_active,
      start_date: c.start_date,
      end_date: c.end_date,
      cpm_rate_inr: c.cpm_rate_inr,
      target_site_urls: c.target_site_urls || [],
      created_at: c.created_at,
      impressions,
      clicks,
      ctr,
      earned_inr,
    }
  })

  return NextResponse.json({ campaigns: enriched, sites: sites || [] })
}
