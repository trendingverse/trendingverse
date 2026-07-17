// app/api/mediation/payouts/generate/route.ts
// ══════════════════════════════════════════════════════════════════
// PAYOUT ENGINE — turns per-site network revenue (partner_revenue) into
// per-publisher earnings (revenue_reports), applying each site's
// revenue_share_pct.
//
// Flow per (site_url, date) in partner_revenue:
//   1. resolve site_url -> sites.id + user_id (publisher)
//   2. find the site's effective revenue_share_pct from publisher_ads
//      (most-common share among that site's enabled ad units)
//   3. publisher_earnings = revenue * share%   ;  platform = revenue - publisher
//   4. upsert into revenue_reports (one row per site/date/network)
//
// Site-level split (partner revenue is per-site, so this matches the data).
// Admin or cron-secret auth. Manual: POST {start,end}. Cron: GET ?secret=
// ══════════════════════════════════════════════════════════════════
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

async function runPayouts(start: string, end: string) {
  const admin = svc()

  // 1. Pull revenue rows in range
  const { data: revRows, error: revErr } = await admin
    .from('partner_revenue')
    .select('site_url, partner_slug, revenue_date, impressions, clicks, revenue_usd, revenue_inr')
    .gte('revenue_date', start).lte('revenue_date', end).limit(100000)
  if (revErr) return { ok: false, error: revErr.message }
  if (!revRows?.length) return { ok: true, generated: 0, note: 'no partner_revenue in range' }

  // 2. Build site_url(host) -> { site_id, user_id } map
  const { data: sites } = await admin.from('sites').select('id, user_id, site_url')
  const siteByHost: Record<string, { id: string; user_id: string }> = {}
  for (const s of sites || []) siteByHost[normHost(s.site_url)] = { id: s.id, user_id: s.user_id }

  // 3. Build site_id -> effective revenue_share_pct (most common among enabled units)
  const { data: pads } = await admin
    .from('publisher_ads').select('site_id, revenue_share_pct, is_enabled')
  const shareVotes: Record<string, Record<number, number>> = {}
  for (const pa of pads || []) {
    if (pa.is_enabled === false) continue
    if (pa.revenue_share_pct == null || !pa.site_id) continue
    shareVotes[pa.site_id] = shareVotes[pa.site_id] || {}
    shareVotes[pa.site_id][pa.revenue_share_pct] = (shareVotes[pa.site_id][pa.revenue_share_pct] || 0) + 1
  }
  const shareBySite: Record<string, number> = {}
  for (const siteId of Object.keys(shareVotes)) {
    // most-common share; tie -> higher share (favours publisher)
    const entries = Object.entries(shareVotes[siteId]).map(([pct, n]) => ({ pct: Number(pct), n }))
    entries.sort((a, b) => (b.n - a.n) || (b.pct - a.pct))
    shareBySite[siteId] = entries[0].pct
  }

  const DEFAULT_SHARE = 70 // fallback when a site has no publisher_ads config

  // 4. Compute + upsert revenue_reports rows
  let generated = 0, skipped = 0
  for (const r of revRows) {
    const host = normHost(r.site_url)
    const site = siteByHost[host]
    if (!site) { skipped++; continue } // revenue for a site we don't recognise
    const sharePct = shareBySite[site.id] ?? DEFAULT_SHARE
    const grossUsd = Number(r.revenue_usd || 0)
    const grossInr = Number(r.revenue_inr || 0)
    const pubUsd = +(grossUsd * sharePct / 100).toFixed(6)
    const platUsd = +(grossUsd - pubUsd).toFixed(6)

    const { error: upErr } = await admin.from('revenue_reports').upsert({
      publisher_id: site.user_id,
      site_id: site.id,
      ad_unit_id: null,               // site-level payout (not per-unit)
      report_date: r.revenue_date,
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      revenue_usd: grossUsd,
      revenue_inr: grossInr,
      revenue_share_pct: sharePct,
      publisher_earnings_usd: pubUsd,
      platform_earnings_usd: platUsd,
      network: r.partner_slug || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'publisher_id,site_id,report_date,network' })
    if (upErr) { skipped++; continue }
    generated++
  }
  return { ok: true, generated, skipped, range: { start, end } }
}

function isCronAuthed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const q = new URL(req.url).searchParams.get('secret')
  const h = req.headers.get('authorization')?.replace('Bearer ', '')
  return q === secret || h === secret || req.headers.get('x-vercel-cron') === '1'
}

export async function POST(req: NextRequest) {
  let authed = isCronAuthed(req)
  if (!authed) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    authed = !!(user && user.email === ADMIN_EMAIL)
  }
  if (!authed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const end = body.end || new Date().toISOString().split('T')[0]
  const start = body.start || new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const result = await runPayouts(start, end)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const end = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 3 * 864e5).toISOString().split('T')[0]
  const result = await runPayouts(start, end)
  return NextResponse.json(result)
}
