// app/api/mediation/report/route.ts  — v3
// ══════════════════════════════════════════════════════════════════
// Now reports on TWO data sources (they measure different things):
//
//   source='plugin'  -> direct_ad_events  (your live WordPress sites)
//     events: impression / viewable / click
//     metrics: impressions, viewable, viewability_rate, clicks, ctr
//     dims: date, site, city, device, ad_unit
//
//   source='mediation' -> mediation_events (universal tag)
//     events: request / fill / nofill / click
//     metrics: requests, fills, fill_rate, overall_fill_rate, clicks, ctr, nofills
//     dims: date, site, partner, position, country, device
//
// The client picks the source; metrics/dims valid for that source are used.
// Revenue/eCPM/rpm are 0 for both until Phase 2 revenue ingestion.
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
  const endInclusive = new Date(new Date(end).getTime() + 864e5).toISOString().split('T')[0]

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ══════════════════════════════════════════════════════════════
  // SOURCE: PLUGIN  (direct_ad_events — your live WordPress sites)
  // ══════════════════════════════════════════════════════════════
  if (source === 'plugin') {
    let q = admin
      .from('direct_ad_events')
      .select('site_url, city, device_type, ad_unit_id, event_type, created_at')
      .gte('created_at', start)
      .lt('created_at', endInclusive)
      .limit(200000)
    if (filters.site_url) q = q.ilike('site_url', `%${filters.site_url}%`)
    const { data: events, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const dimValue = (e: Row, dim: string): string => {
      switch (dim) {
        case 'date': return (e.created_at || '').split('T')[0]
        case 'site': return e.site_url || '(none)'
        case 'city': return e.city || '(unknown)'
        case 'device': return e.device_type || '(unknown)'
        case 'ad_unit': return e.ad_unit_id || '(none)'
        default: return '(all)'
      }
    }

    const groups: Record<string, Row> = {}
    for (const e of events || []) {
      const key = dimensions.map(d => dimValue(e, d)).join(' ‖ ')
      if (!groups[key]) {
        groups[key] = {}
        dimensions.forEach((d, i) => { groups[key][d] = key.split(' ‖ ')[i] })
        groups[key]._impr = 0; groups[key]._view = 0; groups[key]._clicks = 0
      }
      const g = groups[key]
      if (e.event_type === 'impression') g._impr++
      else if (e.event_type === 'viewable') g._view++
      else if (e.event_type === 'click') g._clicks++
    }

    const mv = (g: Row, m: string): number => {
      switch (m) {
        case 'impressions': return g._impr
        case 'viewable': return g._view
        case 'clicks': return g._clicks
        case 'viewability_rate': return g._impr ? +(g._view / g._impr * 100).toFixed(2) : 0
        case 'ctr': return g._impr ? +(g._clicks / g._impr * 100).toFixed(2) : 0
        case 'revenue': case 'ecpm': case 'rpm': return 0
        default: return 0
      }
    }

    const rows = Object.values(groups).map(g => {
      const r: Row = {}
      dimensions.forEach(d => { r[d] = g[d] })
      metrics.forEach(m => { r[m] = mv(g, m) })
      return r
    })
    const sum = (k: string) => Object.values(groups).reduce((s, g) => s + (g[k] || 0), 0)
    const T: Row = { _impr: sum('_impr'), _view: sum('_view'), _clicks: sum('_clicks') }
    const totals: Row = {}
    metrics.forEach(m => { totals[m] = mv(T, m) })
    rows.sort((a, b) => (b[metrics[0]] ?? 0) - (a[metrics[0]] ?? 0))
    return NextResponse.json({ source, dimensions, metrics, rows, totals, row_count: rows.length, date_range: { start, end } })
  }

  // ══════════════════════════════════════════════════════════════
  // SOURCE: MEDIATION  (mediation_events — universal tag)
  // ══════════════════════════════════════════════════════════════
  let q = admin
    .from('mediation_events')
    .select('site_url, position, partner_slug, event_type, fingerprint, created_at')
    .gte('created_at', start)
    .lt('created_at', endInclusive)
    .limit(100000)
  if (filters.site_url) q = q.ilike('site_url', `%${filters.site_url}%`)
  if (filters.position) q = q.eq('position', filters.position)
  const { data: events, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const needProfile = dimensions.includes('country') || dimensions.includes('device')
  const profileMap: Record<string, { country?: string; device?: string }> = {}
  if (needProfile && events?.length) {
    const fps = Array.from(new Set(events.map(e => e.fingerprint).filter(Boolean)))
    for (let i = 0; i < fps.length; i += 500) {
      const { data: profs } = await admin
        .from('audience_profiles').select('fingerprint, country, device_type').in('fingerprint', fps.slice(i, i + 500))
      for (const p of profs || []) profileMap[p.fingerprint] = { country: p.country, device: p.device_type }
    }
  }

  const dimValue = (e: Row, dim: string): string => {
    switch (dim) {
      case 'date': return (e.created_at || '').split('T')[0]
      case 'site': return e.site_url || '(none)'
      case 'partner': return e.partner_slug || '(none)'
      case 'position': return e.position || '(none)'
      case 'country': return profileMap[e.fingerprint]?.country || '(unknown)'
      case 'device': return profileMap[e.fingerprint]?.device || '(unknown)'
      default: return '(all)'
    }
  }
  const contextDims = dimensions.filter(d => d !== 'partner')
  const contextKey = (e: Row) => contextDims.map(d => dimValue(e, d)).join(' ‖ ')

  const requestsByContext: Record<string, number> = {}
  const anyFillByContext: Record<string, number> = {}
  for (const e of events || []) {
    if (e.event_type === 'request') { const k = contextKey(e); requestsByContext[k] = (requestsByContext[k] || 0) + 1 }
    if (e.event_type === 'fill') { const k = contextKey(e); anyFillByContext[k] = (anyFillByContext[k] || 0) + 1 }
  }

  const groups: Record<string, Row> = {}
  const ensure = (e: Row) => {
    const key = dimensions.map(d => dimValue(e, d)).join(' ‖ ')
    if (!groups[key]) {
      groups[key] = { _ctx: contextKey(e) }
      dimensions.forEach((d, i) => { groups[key][d] = key.split(' ‖ ')[i] })
      groups[key]._fills = 0; groups[key]._nofills = 0; groups[key]._clicks = 0; groups[key]._viewable = 0
    }
    return groups[key]
  }
  for (const e of events || []) {
    if (e.event_type === 'request' || e.event_type === 'unfilled' || e.partner_slug === 'request' || e.partner_slug === 'nofill') {
      if (!dimensions.includes('partner')) ensure(e)
      continue
    }
    const g = ensure(e)
    if (e.event_type === 'fill') g._fills++
    else if (e.event_type === 'nofill') g._nofills++
    else if (e.event_type === 'click') g._clicks++
    else if (e.event_type === 'viewable') g._viewable++
  }

  const mv = (g: Row, m: string): number => {
    const reqs = requestsByContext[g._ctx] || 0
    const anyFill = anyFillByContext[g._ctx] || 0
    switch (m) {
      case 'requests': return reqs
      case 'fills': return g._fills
      case 'nofills': return g._nofills
      case 'clicks': return g._clicks
      case 'viewable': return g._viewable
      case 'fill_rate': return reqs ? +(g._fills / reqs * 100).toFixed(2) : 0
      case 'overall_fill_rate': return reqs ? +(anyFill / reqs * 100).toFixed(2) : 0
      case 'ctr': return g._fills ? +(g._clicks / g._fills * 100).toFixed(2) : 0
      case 'viewability_rate': return g._fills ? +(g._viewable / g._fills * 100).toFixed(2) : 0
      case 'revenue': case 'ecpm': case 'rpm': return 0
      default: return 0
    }
  }

  const rows = Object.values(groups).map(g => {
    const r: Row = {}
    dimensions.forEach(d => { r[d] = g[d] })
    metrics.forEach(m => { r[m] = mv(g, m) })
    return r
  })
  const totalRequests = Object.values(requestsByContext).reduce((s, v) => s + v, 0)
  const totalAnyFill = Object.values(anyFillByContext).reduce((s, v) => s + v, 0)
  const sum = (k: string) => Object.values(groups).reduce((s, g) => s + (g[k] || 0), 0)
  const totals: Row = {}
  metrics.forEach(m => {
    switch (m) {
      case 'requests': totals[m] = totalRequests; break
      case 'fills': totals[m] = sum('_fills'); break
      case 'nofills': totals[m] = sum('_nofills'); break
      case 'clicks': totals[m] = sum('_clicks'); break
      case 'viewable': totals[m] = sum('_viewable'); break
      case 'fill_rate': totals[m] = totalRequests ? +(sum('_fills') / totalRequests * 100).toFixed(2) : 0; break
      case 'overall_fill_rate': totals[m] = totalRequests ? +(totalAnyFill / totalRequests * 100).toFixed(2) : 0; break
      case 'ctr': totals[m] = sum('_fills') ? +(sum('_clicks') / sum('_fills') * 100).toFixed(2) : 0; break
      case 'viewability_rate': totals[m] = sum('_fills') ? +(sum('_viewable') / sum('_fills') * 100).toFixed(2) : 0; break
      default: totals[m] = 0
    }
  })
  rows.sort((a, b) => (b[metrics[0]] ?? 0) - (a[metrics[0]] ?? 0))
  return NextResponse.json({ source, dimensions, metrics, rows, totals, row_count: rows.length, date_range: { start, end } })
}
