// app/api/mediation/report/route.ts  — v2
// ══════════════════════════════════════════════════════════════════
// Fixes the "phantom partner" problem. Events are now interpreted by
// what they ARE, not by mis-using partner_slug as an event label:
//
//   request        -> a slot request (NOT a partner). Counts toward Requests.
//   fill  (partner) -> that partner filled. Counts toward that partner's Fills.
//   nofill(partner) -> that partner tried & failed. That partner's No-fills.
//   unfilled       -> whole waterfall empty (partner_slug null). Terminal miss.
//
// Requests are counted per SLOT CONTEXT (date/site/position/geo/device),
// never per partner. Fills/nofills/clicks are counted per partner.
//
// Metrics:
//   requests          = # request events in the group's slot context
//   fills / nofills   = per-partner outcome counts
//   fill_rate         = partner fills / requests-in-context  (per-partner)
//   overall_fill_rate = any fill / requests-in-context        (slot-level)
//   clicks, ctr, viewable, viewability_rate as before
//   revenue/ecpm/rpm  = 0 until Phase 2
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
type Row = Record<string, any>

// Partner-scoped dimensions vs slot-context dimensions.
// Requests live at the slot-context level (everything EXCEPT partner).
const PARTNER_DIM = 'partner'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const dimensions: string[] = Array.isArray(body.dimensions) && body.dimensions.length
    ? body.dimensions : ['date']
  const metrics: string[] = Array.isArray(body.metrics) && body.metrics.length
    ? body.metrics : ['requests', 'fills', 'fill_rate']
  const filters = body.filters || {}
  const start = body.start || new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const end = body.end || new Date().toISOString().split('T')[0]

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const endInclusive = new Date(new Date(end).getTime() + 864e5).toISOString().split('T')[0]
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

  // Resolve geo/device if requested
  const needProfile = dimensions.includes('country') || dimensions.includes('device')
  const profileMap: Record<string, { country?: string; device?: string }> = {}
  if (needProfile && events?.length) {
    const fps = Array.from(new Set(events.map(e => e.fingerprint).filter(Boolean)))
    for (let i = 0; i < fps.length; i += 500) {
      const chunk = fps.slice(i, i + 500)
      const { data: profs } = await admin
        .from('audience_profiles').select('fingerprint, country, device_type').in('fingerprint', chunk)
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

  // Slot-context key = all chosen dimensions EXCEPT partner (requests live here)
  const contextDims = dimensions.filter(d => d !== PARTNER_DIM)
  const contextKey = (e: Row) => contextDims.map(d => dimValue(e, d)).join(' ‖ ')

  // 1) Count REQUESTS per slot context (only event_type='request')
  const requestsByContext: Record<string, number> = {}
  // 2) Count ANY-fill per slot context (for overall fill rate)
  const anyFillByContext: Record<string, number> = {}
  for (const e of events || []) {
    if (e.event_type === 'request') {
      const k = contextKey(e)
      requestsByContext[k] = (requestsByContext[k] || 0) + 1
    }
    if (e.event_type === 'fill') {
      const k = contextKey(e)
      anyFillByContext[k] = (anyFillByContext[k] || 0) + 1
    }
  }

  // 3) Build the actual report groups (by full dimension set)
  const groups: Record<string, Row> = {}
  const ensure = (e: Row) => {
    const key = dimensions.map(d => dimValue(e, d)).join(' ‖ ')
    if (!groups[key]) {
      groups[key] = { _key: key, _ctx: contextKey(e) }
      dimensions.forEach((d, i) => { groups[key][d] = key.split(' ‖ ')[i] })
      groups[key]._fills = 0; groups[key]._nofills = 0; groups[key]._clicks = 0; groups[key]._viewable = 0
    }
    return groups[key]
  }

  for (const e of events || []) {
    // Skip request/unfilled from partner-level rows — they're not partner outcomes.
    // But we still need a row to exist for contexts even if only requests happened.
    if (e.event_type === 'request' || e.event_type === 'unfilled' || e.partner_slug === 'request' || e.partner_slug === 'nofill') {
      // Only materialise a row if partner isn't a chosen dimension (so requests show up
      // in slot-context groupings). If partner IS a dimension, requests don't belong to a partner row.
      if (!dimensions.includes(PARTNER_DIM)) ensure(e)
      continue
    }
    const g = ensure(e)
    switch (e.event_type) {
      case 'fill': g._fills++; break
      case 'nofill': g._nofills++; break
      case 'click': g._clicks++; break
      case 'viewable': g._viewable++; break
    }
  }

  const metricValue = (g: Row, m: string): number => {
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
      case 'revenue': return 0
      case 'ecpm': return 0
      case 'rpm': return 0
      default: return 0
    }
  }

  const rows = Object.values(groups).map(g => {
    const row: Row = {}
    dimensions.forEach(d => { row[d] = g[d] })
    metrics.forEach(m => { row[m] = metricValue(g, m) })
    return row
  })

  // Totals: requests = sum of distinct context requests; fills etc = sum
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

  const sortMetric = metrics[0]
  rows.sort((a, b) => (b[sortMetric] ?? 0) - (a[sortMetric] ?? 0))

  return NextResponse.json({ dimensions, metrics, rows, totals, row_count: rows.length, date_range: { start, end } })
}
