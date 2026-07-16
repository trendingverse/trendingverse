// app/api/mediation/report/route.ts
// ══════════════════════════════════════════════════════════════════
// AD-SERVER REPORTING ENGINE — GAM-style pivot builder backend.
//
// Accepts { metrics[], dimensions[], filters{}, start, end } and returns
// aggregated rows grouped by the chosen dimensions, with the chosen metrics.
//
// Data source: mediation_events (request/fill/nofill/click/viewable).
// Geo/device dimensions are resolved by joining audience_profiles on
// fingerprint. Revenue/eCPM columns are wired but stay 0 until Phase 2
// revenue ingestion populates a revenue source.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// Which raw event_types we count, and the metric keys they feed.
type Row = Record<string, any>

export async function POST(req: NextRequest) {
  // Admin gate
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

  // ── Pull raw events in the date window ──
  // end + 1 day so the whole end date is inclusive
  const endInclusive = new Date(new Date(end).getTime() + 864e5).toISOString().split('T')[0]
  let q = admin
    .from('mediation_events')
    .select('site_url, position, partner_slug, event_type, fingerprint, created_at')
    .gte('created_at', start)
    .lt('created_at', endInclusive)
    .limit(100000)
  if (filters.site_url) q = q.ilike('site_url', `%${filters.site_url}%`)
  if (filters.partner_slug) q = q.eq('partner_slug', filters.partner_slug)
  if (filters.position) q = q.eq('position', filters.position)
  const { data: events, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── If geo/device dimensions requested, resolve fingerprints → profiles ──
  const needProfile = dimensions.includes('country') || dimensions.includes('device')
  const profileMap: Record<string, { country?: string; device?: string }> = {}
  if (needProfile && events?.length) {
    const fps = Array.from(new Set(events.map(e => e.fingerprint).filter(Boolean)))
    // chunk to avoid oversized IN clauses
    for (let i = 0; i < fps.length; i += 500) {
      const chunk = fps.slice(i, i + 500)
      const { data: profs } = await admin
        .from('audience_profiles')
        .select('fingerprint, country, device_type')
        .in('fingerprint', chunk)
      for (const p of profs || []) {
        profileMap[p.fingerprint] = { country: p.country, device: p.device_type }
      }
    }
  }

  // ── Group + aggregate in code ──
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

  const groups: Record<string, Row> = {}
  for (const e of events || []) {
    // Skip the server-side 'request' bookkeeping rows when they're tagged as partner 'request'
    const key = dimensions.map(d => dimValue(e, d)).join(' ‖ ')
    if (!groups[key]) {
      groups[key] = { _key: key }
      dimensions.forEach((d, i) => { groups[key][d] = key.split(' ‖ ')[i] })
      groups[key]._requests = 0; groups[key]._fills = 0; groups[key]._nofills = 0
      groups[key]._clicks = 0; groups[key]._viewable = 0
    }
    const g = groups[key]
    switch (e.event_type) {
      case 'request': g._requests++; break
      case 'fill': g._fills++; break
      case 'nofill': g._nofills++; break
      case 'click': g._clicks++; break
      case 'viewable': g._viewable++; break
    }
  }

  // ── Compute derived metrics + shape output rows ──
  const metricValue = (g: Row, m: string): number => {
    switch (m) {
      case 'requests': return g._requests
      case 'fills': return g._fills
      case 'nofills': return g._nofills
      case 'clicks': return g._clicks
      case 'viewable': return g._viewable
      case 'fill_rate': return g._requests ? +(g._fills / g._requests * 100).toFixed(2) : 0
      case 'ctr': return g._fills ? +(g._clicks / g._fills * 100).toFixed(2) : 0
      case 'viewability_rate': return g._fills ? +(g._viewable / g._fills * 100).toFixed(2) : 0
      // Revenue metrics — wired but 0 until Phase 2 revenue ingestion
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

  // Totals across all groups
  const totals: Row = { _isTotal: true }
  const sum = (k: string) => Object.values(groups).reduce((s, g) => s + (g[k] || 0), 0)
  const T = { _requests: sum('_requests'), _fills: sum('_fills'), _nofills: sum('_nofills'), _clicks: sum('_clicks'), _viewable: sum('_viewable') }
  metrics.forEach(m => { totals[m] = metricValue(T as Row, m) })

  // Default sort: first metric desc
  const sortMetric = metrics[0]
  rows.sort((a, b) => (b[sortMetric] ?? 0) - (a[sortMetric] ?? 0))

  return NextResponse.json({
    dimensions, metrics,
    rows,
    totals,
    row_count: rows.length,
    date_range: { start, end },
  })
}
