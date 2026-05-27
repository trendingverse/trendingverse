import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.email === ADMIN_EMAIL
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '30'
  const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let query = admin.from('revenue_reports')
    .select('*, sites(name, site_url), ad_units(name, position)')
    .gte('report_date', startDate)
    .order('report_date', { ascending: false })

  if (!isAdmin) query = query.eq('publisher_id', user.id)

  const { data: reports } = await query

  // Aggregate stats
  const totalRevenue = (reports || []).reduce((s, r) => s + (r.revenue_usd || 0), 0)
  const totalImpressions = (reports || []).reduce((s, r) => s + (r.impressions || 0), 0)
  const totalClicks = (reports || []).reduce((s, r) => s + (r.clicks || 0), 0)
  const publisherEarnings = (reports || []).reduce((s, r) => s + (r.publisher_earnings_usd || 0), 0)
  const platformEarnings = (reports || []).reduce((s, r) => s + (r.platform_earnings_usd || 0), 0)

  // Per publisher breakdown (admin only)
  let publisherBreakdown: Record<string, unknown>[] = []
  if (isAdmin) {
    const byPublisher: Record<string, { revenue: number; impressions: number; earnings: number; platform: number }> = {}
    for (const r of reports || []) {
      const pid = r.publisher_id
      if (!byPublisher[pid]) byPublisher[pid] = { revenue: 0, impressions: 0, earnings: 0, platform: 0 }
      byPublisher[pid].revenue += r.revenue_usd || 0
      byPublisher[pid].impressions += r.impressions || 0
      byPublisher[pid].earnings += r.publisher_earnings_usd || 0
      byPublisher[pid].platform += r.platform_earnings_usd || 0
    }
    publisherBreakdown = Object.entries(byPublisher).map(([id, stats]) => ({ publisher_id: id, ...stats }))
  }

  return NextResponse.json({
    reports: reports || [],
    stats: { totalRevenue, totalImpressions, totalClicks, publisherEarnings, platformEarnings },
    ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
    ecpm: totalImpressions > 0 ? parseFloat(((totalRevenue / totalImpressions) * 1000).toFixed(4)) : 0,
    publisherBreakdown,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const revenueSharePct = body.revenue_share_pct || 70
  const publisherEarnings = body.revenue_usd * (revenueSharePct / 100)
  const platformEarnings = body.revenue_usd * ((100 - revenueSharePct) / 100)

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await admin.from('revenue_reports').insert({
    publisher_id: body.publisher_id,
    site_id: body.site_id || null,
    ad_unit_id: body.ad_unit_id || null,
    report_date: body.report_date,
    impressions: body.impressions || 0,
    clicks: body.clicks || 0,
    revenue_usd: body.revenue_usd || 0,
    revenue_inr: (body.revenue_usd || 0) * 83,
    revenue_share_pct: revenueSharePct,
    publisher_earnings_usd: publisherEarnings,
    platform_earnings_usd: platformEarnings,
    network: body.network || 'manual',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
