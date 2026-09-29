// app/api/mediation/report/route.ts  — v5
// ══════════════════════════════════════════════════════════════════
// v5:
//  • Requests per PARTNER: serve-slot v3.5 logs each request with the partner
//    of the unit it served, so Requests / Fill Rate are true per-partner numbers.
//    Days logged before that (requests without a partner) keep the old
//    site-level request count, so history never drops to zero.
//  • Revenue / eCPM (and network-reported clicks) joined from partner_revenue
//    (Earnings data) by date + site + partner. Not available when grouping by
//    Ad Position (networks don't report by position).
// v4: aggregation in the DB via RPC (no 1,000-row cap).
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const FALLBACK_USD_INR = 83.5
type Row = Record<string, any>

const host = (s: any) =>
  String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()
const REVENUE_METRICS = ['revenue', 'revenue_inr', 'revenue_usd', 'ecpm', 'ecpm_inr', 'ecpm_usd']

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

async function readRevenue(admin: any, start: string, end: string) {
  const out: any[] = []
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin.from('partner_revenue')
      .select('partner_slug,site_url,revenue_date,impressions,clicks,revenue_usd')
      .gte('revenue_date', start).lte('revenue_date', end)
      .range(from, from + 999)
    if (error) break
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const source: string = body.source === 'mediation' ? 'mediation' : 'plugin'
  const dimensions: string[] = Array.isArray(body.dimensions) && body.dimensions.length ? body.dimensions : ['date']
  const metrics: string[] = Array.isArray(body.metrics) && body.metrics.length ? body.metrics : ['impressions']
  const filters = body.filters || {}
  const start = body.start || new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const end = body.end || new Date().toISOString().split('T')[0]

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const pluginDims = dimensions.filter(d => ['date', 'site', 'city', 'device', 'ad_unit'].includes(d))
  const mediationDims = dimensions.filter(d => ['date', 'site', 'partner', 'position'].includes(d))

  // ══════════════════ PLUGIN SOURCE (unchanged) ══════════════════
  if (source === 'plugin') {
    const { data, error } = await admin.rpc('report_plugin_events', {
      p_start: start, p_end: end,
      p_site: filters.site_url || null,
      p_dims: pluginDims.length ? pluginDims : ['date'],
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const mv = (r: any, m: string): number => {
      const impr = Number(r.impressions || 0), view = Number(r.viewable || 0), clk = Number(r.clicks || 0)
      switch (m) {
        case 'impressions': return impr
        case 'viewable': return view
        case 'clicks': return clk
        case 'viewability_rate': return impr ? +(view / impr * 100).toFixed(2) : 0
        case 'ctr': return impr ? +(clk / impr * 100).toFixed(2) : 0
        default: return 0
      }
    }
    const rows: Row[] = (data || []).map((r: any) => {
      const row: Row = {}
      pluginDims.forEach(d => { row[d] = r.grp?.[d] ?? '(all)' })
      metrics.forEach(m => { row[m] = mv(r, m) })
      return row
    })
    const sumImpr = (data || []).reduce((s: number, r: any) => s + Number(r.impressions || 0), 0)
    const sumView = (data || []).reduce((s: number, r: any) => s + Number(r.viewable || 0), 0)
    const sumClk = (data || []).reduce((s: number, r: any) => s + Number(r.clicks || 0), 0)
    const T = { impressions: sumImpr, viewable: sumView, clicks: sumClk }
    const totals: Row = {}
    metrics.forEach(m => { totals[m] = mv(T, m) })
    rows.sort((a, b) => (b[metrics[0]] ?? 0) - (a[metrics[0]] ?? 0))
    return NextResponse.json({ source, dimensions: pluginDims, metrics, rows, totals, row_count: rows.length, date_range: { start, end } })
  }

  // ══════════════════ MEDIATION SOURCE ══════════════════
  const { data, error } = await admin.rpc('report_mediation_events', {
    p_start: start, p_end: end,
    p_site: filters.site_url || null,
    p_dims: mediationDims.length ? mediationDims : ['date'],
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasPartner = mediationDims.includes('partner')
  const BAD_PARTNERS = ['(none)', 'request', 'nofill', 'unfilled', '(all)', '', 'null']
  const isRealPartner = (p: any) => p != null && !BAD_PARTNERS.includes(String(p))
  const ctxKey = (grp: any) => mediationDims.filter(d => d !== 'partner').map(d => grp?.[d] ?? '(all)').join(' ‖ ')

  // Context totals (all partners) — for Overall Fill Rate and legacy days
  const requestsByCtx: Record<string, number> = {}
  const legacyReqByCtx: Record<string, number> = {}   // requests logged without a partner (before v3.5)
  const anyFillByCtx: Record<string, number> = {}
  for (const r of data || []) {
    const k = ctxKey(r.grp)
    requestsByCtx[k] = (requestsByCtx[k] || 0) + Number(r.requests || 0)
    anyFillByCtx[k] = (anyFillByCtx[k] || 0) + Number(r.fills || 0)
    if (hasPartner && !isRealPartner(r.grp?.partner)) legacyReqByCtx[k] = (legacyReqByCtx[k] || 0) + Number(r.requests || 0)
  }

  // Requests for one row: its own partner requests; legacy site-level count if none were tagged
  const rowRequests = (r: any): number => {
    const k = ctxKey(r.grp)
    if (!hasPartner) return requestsByCtx[k] || 0
    const own = Number(r.requests || 0)
    return own > 0 ? own : (legacyReqByCtx[k] || 0)
  }

  // ── Revenue from Earnings data, keyed by the row's date/site/partner ──
  const wantsRevenue = metrics.some(m => REVENUE_METRICS.includes(m)) || metrics.includes('clicks')
  const revenueSplittable = !mediationDims.includes('position')
  const rate = wantsRevenue ? await usdInr(admin) : FALLBACK_USD_INR
  const revDims = mediationDims.filter(d => d === 'date' || d === 'site' || d === 'partner')
  const revKey = (vals: Record<string, any>) => revDims.map(d => (d === 'site' ? host(vals[d]) : String(vals[d] ?? ''))).join(' ‖ ')
  const revMap: Record<string, { usd: number; imp: number; clk: number }> = {}
  let revTotal = { usd: 0, imp: 0, clk: 0 }
  if (wantsRevenue) {
    const siteFilter = host(filters.site_url)
    const revRows = (await readRevenue(admin, start, end)).filter(r => !siteFilter || host(r.site_url).includes(siteFilter))
    for (const r of revRows) {
      const k = revKey({ date: r.revenue_date, site: r.site_url, partner: r.partner_slug })
      if (!revMap[k]) revMap[k] = { usd: 0, imp: 0, clk: 0 }
      revMap[k].usd += Number(r.revenue_usd || 0)
      revMap[k].imp += Number(r.impressions || 0)
      revMap[k].clk += Number(r.clicks || 0)
      revTotal = { usd: revTotal.usd + Number(r.revenue_usd || 0), imp: revTotal.imp + Number(r.impressions || 0), clk: revTotal.clk + Number(r.clicks || 0) }
    }
  }
  const revFor = (grp: any) => (revenueSplittable ? revMap[revKey(grp || {})] : undefined)

  const revenueMetric = (rev: { usd: number; imp: number } | undefined, m: string): number | null => {
    if (!rev) return null
    const inr = rev.usd * rate
    switch (m) {
      case 'revenue': case 'revenue_inr': return +inr.toFixed(2)
      case 'revenue_usd': return +rev.usd.toFixed(4)
      case 'ecpm': case 'ecpm_inr': return rev.imp ? +(inr / rev.imp * 1000).toFixed(2) : null
      case 'ecpm_usd': return rev.imp ? +(rev.usd / rev.imp * 1000).toFixed(4) : null
      default: return null
    }
  }

  const mv = (r: any, m: string): number | null => {
    const ctx = ctxKey(r.grp)
    const reqs = rowRequests(r)
    const ctxReqs = requestsByCtx[ctx] || 0
    const anyFill = anyFillByCtx[ctx] || 0
    const fills = Number(r.fills || 0), nofills = Number(r.nofills || 0), view = Number(r.viewable || 0)
    const rev = revFor(r.grp)
    const clk = Math.max(Number(r.clicks || 0), rev?.clk || 0) // networks count clicks inside their own frames
    if (REVENUE_METRICS.includes(m)) return revenueMetric(rev, m)
    switch (m) {
      case 'requests': return reqs
      case 'fills': return fills
      case 'nofills': return nofills
      case 'clicks': return clk
      case 'viewable': return view
      case 'fill_rate': return reqs ? +(Math.min(fills, reqs) / reqs * 100).toFixed(2) : 0
      case 'overall_fill_rate': return ctxReqs ? +(anyFill / ctxReqs * 100).toFixed(2) : 0
      case 'ctr': return fills ? +(clk / fills * 100).toFixed(2) : 0
      case 'viewability_rate': return fills ? +(view / fills * 100).toFixed(2) : 0
      default: return 0
    }
  }

  const rows: Row[] = (data || []).map((r: any) => {
    const row: Row = {}
    mediationDims.forEach(d => { row[d] = r.grp?.[d] ?? '(all)' })
    metrics.forEach(m => { row[m] = mv(r, m) })
    return row
  })
  const cleanRows = hasPartner ? rows.filter(r => isRealPartner(r.partner)) : rows

  const totalReq = Object.values(requestsByCtx).reduce((s, v) => s + v, 0)
  const totalAnyFill = Object.values(anyFillByCtx).reduce((s, v) => s + v, 0)
  const sumF = (data || []).reduce((s: number, r: any) => s + Number(r.fills || 0), 0)
  const sumN = (data || []).reduce((s: number, r: any) => s + Number(r.nofills || 0), 0)
  const sumEvC = (data || []).reduce((s: number, r: any) => s + Number(r.clicks || 0), 0)
  const sumC = Math.max(sumEvC, revTotal.clk)
  const sumV = (data || []).reduce((s: number, r: any) => s + Number(r.viewable || 0), 0)
  const totals: Row = {}
  metrics.forEach(m => {
    if (REVENUE_METRICS.includes(m)) { totals[m] = revenueMetric(revTotal, m); return }
    switch (m) {
      case 'requests': totals[m] = totalReq; break
      case 'fills': totals[m] = sumF; break
      case 'nofills': totals[m] = sumN; break
      case 'clicks': totals[m] = sumC; break
      case 'viewable': totals[m] = sumV; break
      case 'fill_rate': totals[m] = totalReq ? +(Math.min(sumF, totalReq) / totalReq * 100).toFixed(2) : 0; break
      case 'overall_fill_rate': totals[m] = totalReq ? +(totalAnyFill / totalReq * 100).toFixed(2) : 0; break
      case 'ctr': totals[m] = sumF ? +(sumC / sumF * 100).toFixed(2) : 0; break
      case 'viewability_rate': totals[m] = sumF ? +(sumV / sumF * 100).toFixed(2) : 0; break
      default: totals[m] = 0
    }
  })
  cleanRows.sort((a, b) => (b[metrics[0]] ?? 0) - (a[metrics[0]] ?? 0))
  return NextResponse.json({
    source, dimensions: mediationDims, metrics, rows: cleanRows, totals, row_count: cleanRows.length,
    date_range: { start, end },
    usd_inr: rate,
    revenue_note: revenueSplittable ? undefined : 'Revenue is not available when grouping by Ad Position.',
  })
}
