// app/api/mediation/revenue/route.ts
// Reads partner_revenue for the monetization dashboard.
// GET ?start&end&partner=&site=  -> { total, by_day, by_partner, by_site, rows }
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const url = new URL(req.url)
  const end = url.searchParams.get('end') || new Date().toISOString().split('T')[0]
  const start = url.searchParams.get('start') || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]
  const partner = url.searchParams.get('partner')
  const site = url.searchParams.get('site')

  let q = admin.from('partner_revenue').select('*')
    .gte('revenue_date', start).lte('revenue_date', end).limit(100000)
  if (partner) q = q.eq('partner_slug', partner)
  if (site) q = q.ilike('site_url', `%${site}%`)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const num = (v: any) => Number(v || 0)
  const total = {
    revenue: rows.reduce((s, r) => s + num(r.revenue_usd), 0),
    impressions: rows.reduce((s, r) => s + num(r.impressions), 0),
    clicks: rows.reduce((s, r) => s + num(r.clicks), 0),
  }
  const group = (key: string) => {
    const m: Record<string, any> = {}
    for (const r of rows) {
      const k = r[key] || '(none)'
      if (!m[k]) m[k] = { key: k, revenue: 0, impressions: 0, clicks: 0 }
      m[k].revenue += num(r.revenue_usd); m[k].impressions += num(r.impressions); m[k].clicks += num(r.clicks)
    }
    return Object.values(m).map((g: any) => ({ ...g, revenue: +g.revenue.toFixed(4) }))
      .sort((a: any, b: any) => b.revenue - a.revenue)
  }

  return NextResponse.json({
    date_range: { start, end },
    total: { ...total, revenue: +total.revenue.toFixed(4) },
    by_day: group('revenue_date'),
    by_partner: group('partner_slug'),
    by_site: group('site_url'),
  })
}
