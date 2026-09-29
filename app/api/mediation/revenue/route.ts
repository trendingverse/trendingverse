// app/api/mediation/revenue/route.ts  — v3
// ══════════════════════════════════════════════════════════════════
// Earnings data for BOTH audiences:
//  • Admin     → every network: totals, by network / site / day, USD + INR, eCPM.
//  • Publisher → only their own sites, only their share (revenue × share %),
//                NO network / partner names are ever returned.
//                v3: only for packages that include ads (growth / pro / byoak / agency);
//                free-plan publishers get { locked: true } instead of figures.
// POST (admin only) → add revenue manually or via CSV rows, for networks
//                     that have no reporting API.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const FALLBACK_USD_INR = 83.5
const DEFAULT_SHARE = 70
const PLANS_WITH_ADS = ['growth', 'pro', 'byoak', 'agency']

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
const host = (s: any) =>
  String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()
const num = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0 }
const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000
const DAY = /^\d{4}-\d{2}-\d{2}$/

// Latest USD→INR rate from currency_rates (either direction stored)
async function usdInr(admin: any): Promise<number> {
  const { data } = await admin
    .from('currency_rates')
    .select('base_currency,target_currency,rate,rate_date')
    .or('and(base_currency.eq.USD,target_currency.eq.INR),and(base_currency.eq.INR,target_currency.eq.USD)')
    .order('rate_date', { ascending: false })
    .limit(1)
  const x = data?.[0]
  if (!x || !Number(x.rate)) return FALLBACK_USD_INR
  const r = x.base_currency === 'USD' ? Number(x.rate) : 1 / Number(x.rate)
  return r > 10 && r < 1000 ? r : FALLBACK_USD_INR
}

// Read partner_revenue in pages (the API caps each read at 1,000 rows)
async function readRevenue(admin: any, start: string, end: string, partner?: string | null) {
  const out: any[] = []
  for (let from = 0; from < 100000; from += 1000) {
    let q = admin.from('partner_revenue')
      .select('partner_slug,site_url,revenue_date,impressions,clicks,revenue_usd')
      .gte('revenue_date', start).lte('revenue_date', end)
      .order('revenue_date', { ascending: false })
      .range(from, from + 999)
    if (partner) q = q.eq('partner_slug', partner)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

type Agg = { key: string; revenue: number; revenue_inr: number; impressions: number; clicks: number; ecpm: number; ecpm_inr: number }
function group(rows: any[], keyOf: (r: any) => string, rate: number, valueOf: (r: any) => number): Agg[] {
  const m = new Map<string, any>()
  for (const r of rows) {
    const k = keyOf(r) || '(none)'
    if (!m.has(k)) m.set(k, { key: k, usd: 0, impressions: 0, clicks: 0 })
    const g = m.get(k)
    g.usd += valueOf(r); g.impressions += num(r.impressions); g.clicks += num(r.clicks)
  }
  return Array.from(m.values()).map(g => ({
    key: g.key,
    revenue: r4(g.usd),
    revenue_inr: r2(g.usd * rate),
    impressions: g.impressions,
    clicks: g.clicks,
    ecpm: g.impressions ? r4((g.usd / g.impressions) * 1000) : 0,
    ecpm_inr: g.impressions ? r2((g.usd * rate / g.impressions) * 1000) : 0,
  }))
}
function totals(rows: any[], rate: number, valueOf: (r: any) => number) {
  return group(rows, () => 'all', rate, valueOf)[0] || { key: 'all', revenue: 0, revenue_inr: 0, impressions: 0, clicks: 0, ecpm: 0, ecpm_inr: 0 }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = user.email === ADMIN_EMAIL

  const admin = svc()
  const url = new URL(req.url)
  const today = new Date().toISOString().split('T')[0]
  let end = url.searchParams.get('end') || today
  let start = url.searchParams.get('start') || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]
  if (!DAY.test(start) || !DAY.test(end)) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  if (start > end) [start, end] = [end, start]
  const rate = await usdInr(admin)

  try {
    // ── ADMIN: every network ──────────────────────────────────────
    if (isAdmin) {
      const partner = url.searchParams.get('partner')
      const site = host(url.searchParams.get('site'))
      let rows = await readRevenue(admin, start, end, partner)
      if (site) rows = rows.filter(r => host(r.site_url).includes(site))
      const val = (r: any) => num(r.revenue_usd)

      const [{ data: partners }, { data: sites }] = await Promise.all([
        admin.from('demand_partners').select('id,name,slug').order('name'),
        admin.from('sites').select('id,name,site_url').order('name'),
      ])
      const sortRev = (a: Agg, b: Agg) => b.revenue - a.revenue
      return NextResponse.json({
        role: 'admin',
        date_range: { start, end },
        usd_inr: rate,
        total: totals(rows, rate, val),
        by_partner: group(rows, r => r.partner_slug, rate, val).sort(sortRev),
        by_site: group(rows, r => host(r.site_url), rate, val).sort(sortRev),
        by_day: group(rows, r => r.revenue_date, rate, val).sort((a, b) => (a.key < b.key ? 1 : -1)),
        partners: partners || [],
        sites: (sites || []).map((s: any) => ({ id: s.id, name: s.name, host: host(s.site_url) })),
      })
    }

    // ── PUBLISHER: own sites, own share, no partner names ─────────
    const { data: prof } = await admin.from('user_profiles').select('plan').eq('id', user.id).maybeSingle()
    const plan = String(prof?.plan || 'free').toLowerCase()
    if (!PLANS_WITH_ADS.includes(plan)) {
      return NextResponse.json({ role: 'publisher', locked: true, plan, date_range: { start, end } })
    }
    const [{ data: owned }, { data: asg }] = await Promise.all([
      admin.from('sites').select('id,name,site_url').eq('user_id', user.id),
      admin.from('publisher_ads').select('site_id,revenue_share_pct,is_enabled').eq('publisher_id', user.id),
    ])
    const siteIds = new Set<string>([...(owned || []).map((s: any) => s.id), ...(asg || []).map((a: any) => a.site_id).filter(Boolean)])
    let siteRows: any[] = owned || []
    const missing = Array.from(siteIds).filter(id => !siteRows.some(s => s.id === id))
    if (missing.length) {
      const { data } = await admin.from('sites').select('id,name,site_url').in('id', missing)
      siteRows = [...siteRows, ...(data || [])]
    }
    const shareOf: Record<string, number> = {}
    for (const s of siteRows) {
      const pcts = (asg || []).filter((a: any) => a.site_id === s.id).map((a: any) => num(a.revenue_share_pct)).filter(Boolean)
      shareOf[host(s.site_url)] = pcts.length ? Math.max(...pcts) : DEFAULT_SHARE
    }
    const hosts = Object.keys(shareOf).filter(Boolean)
    const mySites = siteRows.map((s: any) => ({ name: s.name, host: host(s.site_url), share_pct: shareOf[host(s.site_url)] }))

    if (!hosts.length) {
      return NextResponse.json({ role: 'publisher', date_range: { start, end }, usd_inr: rate, sites: [], total: totals([], rate, () => 0), by_site: [], by_day: [] })
    }
    const all = await readRevenue(admin, start, end)
    const matchHost = (h: string) => hosts.find(x => h === x || h.endsWith('.' + x) || x.endsWith('.' + h))
    const rows = all
      .map(r => ({ ...r, _host: matchHost(host(r.site_url)) }))
      .filter(r => r._host)
    const earn = (r: any) => num(r.revenue_usd) * (shareOf[r._host] || DEFAULT_SHARE) / 100

    const strip = (a: Agg[]) => a.map(g => ({ key: g.key, earnings: g.revenue, earnings_inr: g.revenue_inr, impressions: g.impressions, clicks: g.clicks, ecpm: g.ecpm, ecpm_inr: g.ecpm_inr }))
    const t = totals(rows, rate, earn)
    return NextResponse.json({
      role: 'publisher',
      date_range: { start, end },
      usd_inr: rate,
      sites: mySites,
      total: { earnings: t.revenue, earnings_inr: t.revenue_inr, impressions: t.impressions, clicks: t.clicks, ecpm: t.ecpm, ecpm_inr: t.ecpm_inr },
      by_site: strip(group(rows, r => r._host, rate, earn)).sort((a, b) => b.earnings - a.earnings),
      by_day: strip(group(rows, r => r.revenue_date, rate, earn)).sort((a, b) => (a.key < b.key ? 1 : -1)),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load revenue' }, { status: 500 })
  }
}

// ── Manual / CSV revenue entry (admin) ───────────────────────────
// body: { entries: [{ partner_id, site, date, impressions, clicks, revenue, currency }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = svc()
  const body = await req.json().catch(() => ({}))
  const entries: any[] = Array.isArray(body.entries) ? body.entries.slice(0, 2000) : []
  if (!entries.length) return NextResponse.json({ error: 'No rows to save' }, { status: 400 })

  const { data: partners } = await admin.from('demand_partners').select('id,slug')
  const slugOf: Record<string, string> = {}
  for (const p of partners || []) slugOf[p.id] = p.slug
  const rate = await usdInr(admin)

  // merge duplicates (same partner + site + day) before saving
  const merged = new Map<string, any>()
  const errors: string[] = []
  entries.forEach((e, i) => {
    const pid = String(e.partner_id || '')
    const site = host(e.site)
    const date = String(e.date || '').slice(0, 10)
    const cur = String(e.currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD'
    const rev = num(e.revenue)
    if (!slugOf[pid]) return errors.push(`Row ${i + 1}: choose a network`)
    if (!site) return errors.push(`Row ${i + 1}: site missing`)
    if (!DAY.test(date)) return errors.push(`Row ${i + 1}: date must be YYYY-MM-DD`)
    const k = `${pid}|${site}|${date}`
    if (!merged.has(k)) merged.set(k, { pid, site, date, cur, rev: 0, imp: 0, clk: 0 })
    const m = merged.get(k)
    m.rev += rev; m.imp += num(e.impressions); m.clk += num(e.clicks)
  })
  if (errors.length) return NextResponse.json({ error: errors.slice(0, 5).join(' · ') }, { status: 400 })

  const rows = Array.from(merged.values()).map(m => {
    const usd = m.cur === 'INR' ? m.rev / rate : m.rev
    return {
      partner_id: m.pid,
      partner_slug: slugOf[m.pid],
      site_url: m.site,
      revenue_date: m.date,
      impressions: Math.round(m.imp),
      clicks: Math.round(m.clk),
      revenue_usd: +usd.toFixed(6),
      revenue_inr: +(usd * rate).toFixed(4),
      currency: m.cur,
      raw: { source: 'manual', entered_by: user.email, usd_inr_rate: rate },
      synced_at: new Date().toISOString(),
    }
  })
  const { error } = await admin.from('partner_revenue').upsert(rows, { onConflict: 'partner_id,site_url,revenue_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, saved: rows.length })
}
