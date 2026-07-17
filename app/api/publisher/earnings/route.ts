// app/api/publisher/earnings/route.ts
// ══════════════════════════════════════════════════════════════════
// PUBLISHER earnings — reads revenue_reports for the CURRENT user only.
// Returns ONLY their share (publisher_earnings). NEVER exposes network,
// gross revenue, platform margin, or share % to the client.
//
// Admins can optionally pass ?publisher_id= to view a specific publisher
// (for the admin payouts screen); non-admins are always locked to self.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = user.email === ADMIN_EMAIL

  const url = new URL(req.url)
  const end = url.searchParams.get('end') || new Date().toISOString().split('T')[0]
  const start = url.searchParams.get('start') || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]
  // Non-admins are ALWAYS locked to their own id. Admin may target one.
  const targetPublisher = isAdmin ? (url.searchParams.get('publisher_id') || user.id) : user.id

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // site_id -> site_url (for display), scoped to this publisher's sites
  const { data: sites } = await admin.from('sites').select('id, site_url, name').eq('user_id', targetPublisher)
  const siteName: Record<string, string> = {}
  for (const s of sites || []) siteName[s.id] = s.name || s.site_url

  const { data: rows, error } = await admin
    .from('revenue_reports')
    .select('site_id, report_date, impressions, clicks, publisher_earnings_usd, revenue_inr, revenue_share_pct, publisher_earnings_usd')
    .eq('publisher_id', targetPublisher)
    .gte('report_date', start).lte('report_date', end)
    .limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Publisher's INR earnings = revenue_inr * share%  (we don't store pub_inr,
  // so derive it from the same split for display parity).
  const num = (v: any) => Number(v || 0)
  const enriched = (rows || []).map(r => ({
    site: siteName[r.site_id] || '(site)',
    date: r.report_date,
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    earnings_usd: num(r.publisher_earnings_usd),
    earnings_inr: +(num(r.revenue_inr) * num(r.revenue_share_pct) / 100).toFixed(2),
  }))

  const total = {
    earnings_usd: +enriched.reduce((s, r) => s + r.earnings_usd, 0).toFixed(4),
    earnings_inr: +enriched.reduce((s, r) => s + r.earnings_inr, 0).toFixed(2),
    impressions: enriched.reduce((s, r) => s + r.impressions, 0),
    clicks: enriched.reduce((s, r) => s + r.clicks, 0),
  }
  const groupBy = (key: 'site' | 'date') => {
    const m: Record<string, any> = {}
    for (const r of enriched) {
      const k = (r as any)[key]
      if (!m[k]) m[k] = { key: k, earnings_usd: 0, earnings_inr: 0, impressions: 0, clicks: 0 }
      m[k].earnings_usd += r.earnings_usd; m[k].earnings_inr += r.earnings_inr
      m[k].impressions += r.impressions; m[k].clicks += r.clicks
    }
    return Object.values(m).map((g: any) => ({ ...g, earnings_usd: +g.earnings_usd.toFixed(4), earnings_inr: +g.earnings_inr.toFixed(2) }))
      .sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)))
  }

  return NextResponse.json({
    date_range: { start, end },
    total,
    by_site: groupBy('site'),
    by_day: groupBy('date'),
  })
}
