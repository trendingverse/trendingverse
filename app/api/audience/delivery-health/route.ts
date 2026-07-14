// app/api/audience/delivery-health/route.ts
// Flags campaigns that SHOULD be delivering but aren't — the check that
// would have caught the July-4 outage on day one instead of day five.
//
// A campaign is "silent" if it is active, approved, and within its flight
// window, yet logged ZERO impressions in the last 24h. Cumulative totals
// (shown elsewhere) hide this — they look populated while serving is dark.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const today = new Date().toISOString().split('T')[0]
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // All campaigns (we classify each one)
  const { data: campaigns } = await admin
    .from('direct_ads')
    .select('id, campaign_name, is_active, approval_status, priority_tier, position, start_date, end_date, impressions, target_countries, target_all')

  if (!campaigns?.length) {
    return NextResponse.json({ generated_at: new Date().toISOString(), silent: [], healthy: [], inactive: [] })
  }

  // Impressions in the last 24h, grouped by ad_id
  const { data: recentEvents } = await admin
    .from('direct_ad_events')
    .select('ad_id')
    .eq('event_type', 'impression')
    .gte('created_at', since)

  const recentByAd: Record<string, number> = {}
  for (const e of recentEvents || []) {
    recentByAd[e.ad_id] = (recentByAd[e.ad_id] || 0) + 1
  }

  const silent: any[] = []
  const healthy: any[] = []
  const inactive: any[] = []

  for (const c of campaigns) {
    const recent = recentByAd[c.id] || 0
    // Is the campaign SUPPOSED to be delivering right now?
    const inFlight =
      (!c.start_date || c.start_date <= today) &&
      (!c.end_date || c.end_date >= today)
    const shouldDeliver = c.is_active && c.approval_status === 'approved' && inFlight

    const row = {
      id: c.id,
      campaign_name: c.campaign_name,
      priority_tier: c.priority_tier || 2,
      position: c.position,
      recent_impressions_24h: recent,
      total_impressions: c.impressions || 0,
      start_date: c.start_date,
      end_date: c.end_date,
      // A geo-scoped campaign legitimately gets 0 impressions when no
      // matching visitors showed up — flag it, but note the caveat.
      geo_scoped: Array.isArray(c.target_countries) && c.target_countries.length > 0,
    }

    if (!shouldDeliver) {
      inactive.push({ ...row, reason: !c.is_active ? 'paused' : c.approval_status !== 'approved' ? 'not approved' : 'out of flight' })
    } else if (recent === 0) {
      silent.push(row)   // ⚠ active + in flight + approved, but ZERO recent delivery
    } else {
      healthy.push(row)
    }
  }

  // sort silent by total impressions desc (bigger campaigns = bigger concern)
  silent.sort((a, b) => b.total_impressions - a.total_impressions)

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    window_hours: 24,
    summary: {
      silent: silent.length,
      healthy: healthy.length,
      inactive: inactive.length,
    },
    silent,
    healthy,
    inactive,
  })
}
