// app/api/mediation/report/route.ts  — v4
// ══════════════════════════════════════════════════════════════════
// Fixes the Supabase 1,000-row cap by aggregating IN THE DATABASE via
// RPC functions (report_plugin_events / report_mediation_events) instead
// of pulling raw event rows into JS. Correct at any data volume.
//
// NOTE: geo/device breakdown for the MEDIATION source (which needs a
// fingerprint→profile join) is not done in this DB function; for those
// two dimensions it falls back to '(unknown)'. Plugin source has city/
// device natively, so those work directly.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
type Row = Record<string, any>

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

  // Dimensions the DB function can group by (geo/device on mediation excluded)
  const pluginDims = dimensions.filter(d => ['date', 'site', 'city', 'device', 'ad_unit'].includes(d))
  const mediationDims = dimensions.filter(d => ['date', 'site', 'partner', 'position'].includes(d))

  // ══════════════════ PLUGIN SOURCE ══════════════════
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
    // Totals
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

  // Requests live at the slot-context level (all dims except partner).
  // Build request/anyfill totals per context by re-summing the grouped rows.
  const hasPartner = mediationDims.includes('partner')
  const ctxKey = (grp: any) => mediationDims.filter(d => d !== 'partner').map(d => grp?.[d] ?? '(all)').join(' ‖ ')
  const requestsByCtx: Record<string, number> = {}
  const anyFillByCtx: Record<string, number> = {}
  for (const r of data || []) {
    const k = ctxKey(r.grp)
    requestsByCtx[k] = (requestsByCtx[k] || 0) + Number(r.requests || 0)
    anyFillByCtx[k] = (anyFillByCtx[k] || 0) + Number(r.fills || 0)
  }

  const mv = (r: any, m: string): number => {
    const ctx = ctxKey(r.grp)
    const reqs = requestsByCtx[ctx] || 0
    const anyFill = anyFillByCtx[ctx] || 0
    const fills = Number(r.fills || 0), nofills = Number(r.nofills || 0), clk = Number(r.clicks || 0), view = Number(r.viewable || 0)
    switch (m) {
      case 'requests': return reqs
      case 'fills': return fills
      case 'nofills': return nofills
      case 'clicks': return clk
      case 'viewable': return view
      case 'fill_rate': return reqs ? +(fills / reqs * 100).toFixed(2) : 0
      case 'overall_fill_rate': return reqs ? +(anyFill / reqs * 100).toFixed(2) : 0
      case 'ctr': return fills ? +(clk / fills * 100).toFixed(2) : 0
      case 'viewability_rate': return fills ? +(view / fills * 100).toFixed(2) : 0
      default: return 0
    }
  }

  // When partner isn't a dimension, request rows and fill rows may share a grp;
  // just map each returned group to a row.
  const rows: Row[] = (data || []).map((r: any) => {
    const row: Row = {}
    mediationDims.forEach(d => { row[d] = r.grp?.[d] ?? '(all)' })
    metrics.forEach(m => { row[m] = mv(r, m) })
    return row
  })
  // Drop rows that are pure request bookkeeping (partner '(none)') when partner is a dim
  const cleanRows = hasPartner ? rows.filter(r => r.partner && r.partner !== '(none)') : rows

  const totalReq = Object.values(requestsByCtx).reduce((s, v) => s + v, 0)
  const totalAnyFill = Object.values(anyFillByCtx).reduce((s, v) => s + v, 0)
  const sumF = (data || []).reduce((s: number, r: any) => s + Number(r.fills || 0), 0)
  const sumN = (data || []).reduce((s: number, r: any) => s + Number(r.nofills || 0), 0)
  const sumC = (data || []).reduce((s: number, r: any) => s + Number(r.clicks || 0), 0)
  const sumV = (data || []).reduce((s: number, r: any) => s + Number(r.viewable || 0), 0)
  const totals: Row = {}
  metrics.forEach(m => {
    switch (m) {
      case 'requests': totals[m] = totalReq; break
      case 'fills': totals[m] = sumF; break
      case 'nofills': totals[m] = sumN; break
      case 'clicks': totals[m] = sumC; break
      case 'viewable': totals[m] = sumV; break
      case 'fill_rate': totals[m] = totalReq ? +(sumF / totalReq * 100).toFixed(2) : 0; break
      case 'overall_fill_rate': totals[m] = totalReq ? +(totalAnyFill / totalReq * 100).toFixed(2) : 0; break
      case 'ctr': totals[m] = sumF ? +(sumC / sumF * 100).toFixed(2) : 0; break
      case 'viewability_rate': totals[m] = sumF ? +(sumV / sumF * 100).toFixed(2) : 0; break
      default: totals[m] = 0
    }
  })
  cleanRows.sort((a, b) => (b[metrics[0]] ?? 0) - (a[metrics[0]] ?? 0))
  return NextResponse.json({ source, dimensions: mediationDims, metrics, rows: cleanRows, totals, row_count: cleanRows.length, date_range: { start, end } })
}
