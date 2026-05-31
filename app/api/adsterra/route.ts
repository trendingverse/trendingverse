import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = process.env.ADSTERRA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ADSTERRA_API_KEY not set' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '7'

  // Calculate date range
  const end = new Date()
  const start = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().split('T')[0]
  const endDate = end.toISOString().split('T')[0]

  try {
    // Fetch stats from Adsterra Publisher API
    const [statsRes, domainRes] = await Promise.all([
      // Overall stats grouped by date
      fetch(
        `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`,
        { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } }
      ),
      // Stats grouped by domain
      fetch(
        `https://api3.adsterratools.com/publisher/stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`,
        { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } }
      ),
    ])

    if (!statsRes.ok) {
      const err = await statsRes.text()
      return NextResponse.json({
        error: `Adsterra API error ${statsRes.status}: ${err.slice(0, 100)}`
      }, { status: 500 })
    }

    const statsData = await statsRes.json()
    const domainData = domainRes.ok ? await domainRes.json() : { items: [] }

    // Parse stats by date
    const items = statsData.items || []
    const chartData = items.map((item: {
      date?: string; impressions?: number; clicks?: number
      ctr?: number; cpm?: number; revenue?: number
    }) => ({
      date: item.date || '',
      impressions: item.impressions || 0,
      clicks: item.clicks || 0,
      ctr: parseFloat((item.ctr || 0).toFixed(2)),
      cpm: parseFloat((item.cpm || 0).toFixed(4)),
      revenue: parseFloat((item.revenue || 0).toFixed(4)),
    }))

    // Aggregate totals
    const totals = chartData.reduce((acc: {
      impressions: number; clicks: number; revenue: number
    }, d: { impressions: number; clicks: number; revenue: number }) => ({
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      revenue: acc.revenue + d.revenue,
    }), { impressions: 0, clicks: 0, revenue: 0 })

    const avgCpm = totals.impressions > 0
      ? parseFloat(((totals.revenue / totals.impressions) * 1000).toFixed(4))
      : 0
    const avgCtr = totals.impressions > 0
      ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2))
      : 0

    // Domain breakdown
    const domains = (domainData.items || []).map((d: {
      domain?: string; impressions?: number; clicks?: number; revenue?: number; cpm?: number
    }) => ({
      domain: d.domain || 'Unknown',
      impressions: d.impressions || 0,
      clicks: d.clicks || 0,
      revenue: parseFloat((d.revenue || 0).toFixed(4)),
      cpm: parseFloat((d.cpm || 0).toFixed(4)),
    })).sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)

    return NextResponse.json({
      period: { startDate, endDate, days: parseInt(period) },
      totals: {
        impressions: totals.impressions,
        clicks: totals.clicks,
        revenue_usd: parseFloat(totals.revenue.toFixed(4)),
        revenue_inr: parseFloat((totals.revenue * 83).toFixed(2)),
        cpm: avgCpm,
        ctr: avgCtr,
      },
      chartData,
      domains,
      network: 'Adsterra',
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
