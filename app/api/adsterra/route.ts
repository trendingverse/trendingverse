import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

async function fetchAdsterra(endpoint: string, apiKey: string) {
  const res = await fetch(`https://api3.adsterratools.com/publisher/${endpoint}`, {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Adsterra API ${res.status}: ${err.slice(0, 150)}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ADSTERRA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ADSTERRA_API_KEY not set' }, { status: 500 })

  const isAdmin = user.email === ADMIN_EMAIL
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '7'

  const end = new Date()
  const start = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().split('T')[0]
  const endDate = end.toISOString().split('T')[0]

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    if (isAdmin) {
      // ── ADMIN: full data — all domains, all metrics ──────────────
      const [dateStats, domainStats] = await Promise.all([
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`, apiKey),
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`, apiKey),
      ])

      // Map domains to publishers
      const { data: sites } = await admin
        .from('sites')
        .select('site_url, name, user_id, user_profiles(plan)')

      const { data: publisherAds } = await admin
        .from('publisher_ads')
        .select('publisher_id, revenue_share_pct, sites(site_url)')

      // Build domain → publisher map
      const domainPublisherMap: Record<string, { siteName: string; revenueSharePct: number }> = {}
      for (const site of sites || []) {
        const domain = (site.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        const pa = (publisherAds || []).find((p: { sites: unknown }) => {
  const siteUrl = (p.sites as { site_url?: string } | null)?.site_url || ''
  return siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') === domain
})
        domainPublisherMap[domain] = {
          siteName: site.name || domain,
          revenueSharePct: pa?.revenue_share_pct || 70,
        }
      }

      const chartData = (dateStats.items || []).map((item: {
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

      const domains = (domainStats.items || []).map((d: {
        domain?: string; impressions?: number; clicks?: number
        revenue?: number; cpm?: number; ctr?: number
      }) => {
        const domain = (d.domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        const publisherInfo = domainPublisherMap[domain] || { siteName: domain, revenueSharePct: 70 }
        const grossRevenue = d.revenue || 0
        const publisherEarnings = grossRevenue * (publisherInfo.revenueSharePct / 100)
        const platformEarnings = grossRevenue * ((100 - publisherInfo.revenueSharePct) / 100)
        return {
          domain: d.domain || 'Unknown',
          site_name: publisherInfo.siteName,
          impressions: d.impressions || 0,
          clicks: d.clicks || 0,
          ctr: parseFloat((d.ctr || 0).toFixed(2)),
          cpm: parseFloat((d.cpm || 0).toFixed(4)),
          gross_revenue: parseFloat(grossRevenue.toFixed(4)),
          publisher_earnings: parseFloat(publisherEarnings.toFixed(4)),
          platform_earnings: parseFloat(platformEarnings.toFixed(4)),
          revenue_share_pct: publisherInfo.revenueSharePct,
        }
      }).sort((a: { gross_revenue: number }, b: { gross_revenue: number }) => b.gross_revenue - a.gross_revenue)

      const totals = chartData.reduce((acc: { impressions: number; clicks: number; revenue: number }, d: { impressions: number; clicks: number; revenue: number }) => ({
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        revenue: acc.revenue + d.revenue,
      }), { impressions: 0, clicks: 0, revenue: 0 })

      return NextResponse.json({
        role: 'admin',
        period: { startDate, endDate, days: parseInt(period) },
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          revenue_usd: parseFloat(totals.revenue.toFixed(4)),
          revenue_inr: parseFloat((totals.revenue * 83).toFixed(2)),
          publisher_earnings_usd: parseFloat(domains.reduce((s: number, d: { publisher_earnings: number }) => s + d.publisher_earnings, 0).toFixed(4)),
          platform_earnings_usd: parseFloat(domains.reduce((s: number, d: { platform_earnings: number }) => s + d.platform_earnings, 0).toFixed(4)),
          cpm: totals.impressions > 0 ? parseFloat(((totals.revenue / totals.impressions) * 1000).toFixed(4)) : 0,
          ctr: totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
        },
        chartData,
        domains, // admin sees domain names and full breakdown
        network: 'Adsterra',
      })

    } else {
      // ── PUBLISHER: only their own site's metrics, no domain/advertiser names ──
      const { data: publisherSites } = await admin
        .from('sites')
        .select('site_url, name')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!publisherSites?.length) {
        return NextResponse.json({ role: 'publisher', no_site: true })
      }

      // Get their revenue share
      const { data: publisherAd } = await admin
        .from('publisher_ads')
        .select('revenue_share_pct')
        .eq('publisher_id', user.id)
        .limit(1)
        .single()

      const revenueSharePct = publisherAd?.revenue_share_pct || 70

      // Fetch domain stats and filter for publisher's sites only
      const domainStats = await fetchAdsterra(
        `stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`,
        apiKey
      )

      // Match publisher's sites against Adsterra domains
      const publisherDomains = (publisherSites || []).map(s =>
        (s.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      )

      const matchedStats = (domainStats.items || []).filter((d: { domain?: string }) => {
        const adsterraDomain = (d.domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
        return publisherDomains.some(pd => adsterraDomain.includes(pd) || pd.includes(adsterraDomain))
      })

      // Aggregate publisher's stats
      const publisherTotals = matchedStats.reduce((acc: {
        impressions: number; clicks: number; revenue: number
      }, d: { impressions?: number; clicks?: number; revenue?: number }) => ({
        impressions: acc.impressions + (d.impressions || 0),
        clicks: acc.clicks + (d.clicks || 0),
        revenue: acc.revenue + (d.revenue || 0),
      }), { impressions: 0, clicks: 0, revenue: 0 })

      const grossRevenue = publisherTotals.revenue
      const publisherEarnings = grossRevenue * (revenueSharePct / 100)

      // Daily chart for publisher (no domain names)
      const dateStats = await fetchAdsterra(
        `stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`,
        apiKey
      )

      const chartData = (dateStats.items || []).map((item: {
        date?: string; impressions?: number; clicks?: number; revenue?: number
      }) => ({
        date: item.date || '',
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        // Scale to publisher's share of total traffic
        earnings: grossRevenue > 0
          ? parseFloat(((item.revenue || 0) * (revenueSharePct / 100)).toFixed(4))
          : 0,
      }))

      return NextResponse.json({
        role: 'publisher',
        period: { startDate, endDate, days: parseInt(period) },
        revenue_share_pct: revenueSharePct,
        totals: {
          impressions: publisherTotals.impressions,
          clicks: publisherTotals.clicks,
          gross_revenue_usd: parseFloat(grossRevenue.toFixed(4)),
          your_earnings_usd: parseFloat(publisherEarnings.toFixed(4)),
          your_earnings_inr: parseFloat((publisherEarnings * 83).toFixed(2)),
          cpm: publisherTotals.impressions > 0
            ? parseFloat(((grossRevenue / publisherTotals.impressions) * 1000).toFixed(4))
            : 0,
          ctr: publisherTotals.impressions > 0
            ? parseFloat(((publisherTotals.clicks / publisherTotals.impressions) * 100).toFixed(2))
            : 0,
        },
        chartData,
        // No domain names shown to publishers
        network: 'Ad Network',
      })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
