// app/api/mediation/payouts/diagnostic/route.ts
// Shows which partner_revenue site_urls match / don't match sites table
// Admin-only GET
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function normHost(u: string) {
  return (u || '').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '').toLowerCase()
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = svc()

  // Last 90 days of partner_revenue
  const since = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
  const { data: revRows } = await admin
    .from('partner_revenue')
    .select('site_url, partner_slug, revenue_date, revenue_usd')
    .gte('revenue_date', since)
    .limit(10000)

  const { data: sites } = await admin.from('sites').select('id, user_id, site_url')
  const { data: pads } = await admin.from('publisher_ads').select('site_id, revenue_share_pct, is_enabled')

  // Build lookup
  const siteByHost: Record<string, { id: string; user_id: string; raw_url: string }> = {}
  for (const s of sites || []) siteByHost[normHost(s.site_url)] = { id: s.id, user_id: s.user_id, raw_url: s.site_url }

  // Group revenue rows by normalised site_url
  const urlMap: Record<string, { raw: string; normalised: string; total_usd: number; partners: Set<string>; rows: number; matched: boolean; matched_site_id?: string }> = {}
  for (const r of revRows || []) {
    const norm = normHost(r.site_url)
    if (!urlMap[norm]) urlMap[norm] = { raw: r.site_url, normalised: norm, total_usd: 0, partners: new Set(), rows: 0, matched: false }
    urlMap[norm].total_usd += Number(r.revenue_usd || 0)
    urlMap[norm].partners.add(r.partner_slug || 'unknown')
    urlMap[norm].rows++
    const site = siteByHost[norm]
    if (site) { urlMap[norm].matched = true; urlMap[norm].matched_site_id = site.id }
  }

  const matched = []
  const unmatched = []
  for (const [, v] of Object.entries(urlMap)) {
    const entry = { raw_url: v.raw, normalised: v.normalised, rows: v.rows, total_usd: +v.total_usd.toFixed(4), partners: [...v.partners] }
    v.matched ? matched.push({ ...entry, site_id: v.matched_site_id }) : unmatched.push(entry)
  }

  // Share config per matched site
  const shareMap: Record<string, number | null> = {}
  const shareVotes: Record<string, Record<number, number>> = {}
  for (const pa of pads || []) {
    if (pa.is_enabled === false || pa.revenue_share_pct == null || !pa.site_id) continue
    shareVotes[pa.site_id] = shareVotes[pa.site_id] || {}
    shareVotes[pa.site_id][pa.revenue_share_pct] = (shareVotes[pa.site_id][pa.revenue_share_pct] || 0) + 1
  }
  for (const siteId of Object.keys(shareVotes)) {
    const entries = Object.entries(shareVotes[siteId]).map(([pct, n]) => ({ pct: Number(pct), n }))
    entries.sort((a, b) => (b.n - a.n) || (b.pct - a.pct))
    shareMap[siteId] = entries[0].pct
  }

  // Check revenue_reports written
  const { data: reportRows } = await admin
    .from('revenue_reports')
    .select('site_id, report_date, revenue_usd, publisher_earnings_usd')
    .gte('report_date', since)
    .limit(1000)

  return NextResponse.json({
    summary: {
      partner_revenue_rows: revRows?.length || 0,
      distinct_site_urls: Object.keys(urlMap).length,
      matched_urls: matched.length,
      unmatched_urls: unmatched.length,
      revenue_report_rows_written: reportRows?.length || 0,
    },
    sites_in_db: (sites || []).map(s => ({ id: s.id, user_id: s.user_id, site_url: s.site_url, normalised: normHost(s.site_url), share_pct: shareMap[s.id] ?? null })),
    matched_revenue_urls: matched,
    unmatched_revenue_urls: unmatched,
    recent_revenue_reports: (reportRows || []).slice(0, 20),
  })
}
