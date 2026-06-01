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

function parseItem(item: Record<string, unknown>) {
  const impressions = Number(item.impression ?? item.impressions ?? item.views ?? 0)
  const clicks = Number(item.clicks ?? 0)
  const ctr = parseFloat(String(item.ctr ?? 0))
  const cpm = parseFloat(String(item.cpm ?? 0))
  const revenue = parseFloat(String(item.revenue ?? item.earnings ?? 0))
  const date = String(item.date ?? item.day ?? item.start_date ?? item.period ?? '')
  return { impressions, clicks, ctr, cpm, revenue, date }
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
  const startDate = searchParams.get('start') || new Date(Date.now() - parseInt(period) * 86400000).toISOString().split('T')[0]
  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0]
  const debug = searchParams.get('debug') === '1'

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    if (isAdmin) {
      const [dateStats, domainStats] = await Promise.all([
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`, apiKey),
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`, apiKey),
      ])

      if (debug) {
        return NextResponse.json({
          debug: true,
          dateStats_first: dateStats.items?.[0],
          domainStats_first: domainStats.items?.[0],
          all_date_keys: dateStats.items?.[0] ? Object.keys(dateStats.items[0]) : [],
          all_domain_keys: domainStats.items?.[0] ? Object.keys(domainStats.items[0]) : [],
        })
      }

      const { data: sites } = await admin
        .from('sites')
        .select('site_url, name, user_id, adsterra_domain_id')

      const { data: publisherAds } = await admin
        .from('publisher_ads')
        .select('publisher_id, revenue_share_pct, sites(site_url)')

      // Build adsterra_domain_id → site info map
      const domainIdMap: Record<string, { siteName: string; siteUrl: string; revenueSharePct: number }> = {}
      for (const site of sites || []) {
        if (!site.adsterra_domain_id) continue
        const pa = (publisherAds || []).find((p: { sites: unknown }) => {
          const siteUrl = (p.sites as { site_url?: string } | null)?.site_url || ''
          return String(siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, '') ===
            String(site.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        })
        domainIdMap[String(site.adsterra_domain_id)] = {
          siteName: site.name || site.site_url || '',
          siteUrl: site.site_url || '',
          revenueSharePct: pa?.revenue_share_pct || 70,
        }
      }

      const items: Record<string, unknown>[] = dateStats.items || []
      const chartData = items.map(item => {
        const parsed = parseItem(item)
        return {
          date: parsed.date,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
          ctr: parseFloat(parsed.ctr.toFixed(2)),
          cpm: parseFloat(parsed.cpm.toFixed(4)),
          revenue: parseFloat(parsed.revenue.toFixed(4)),
        }
      })

      const totals = chartData.reduce((acc, d) => ({
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        revenue: acc.revenue + d.revenue,
      }), { impressions: 0, clicks: 0, revenue: 0 })

      const domains = (domainStats.items || []).map((d: Record<string, unknown>) => {
        const rawId = String(d.domain ?? d.domain_id ?? d.id ?? 'Unknown')
        const siteInfo = domainIdMap[rawId] || { siteName: rawId, siteUrl: rawId, revenueSharePct: 70 }
        const parsed = parseItem(d)
        const grossRevenue = parsed.revenue
        const publisherEarnings = grossRevenue * (siteInfo.revenueSharePct / 100)
        const platformEarnings = grossRevenue - publisherEarnings
        return {
          domain: siteInfo.siteUrl || rawId,
          site_name: siteInfo.siteName,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
          ctr: parseFloat(parsed.ctr.toFixed(2)),
          cpm: parseFloat(parsed.cpm.toFixed(4)),
          gross_revenue: parseFloat(grossRevenue.toFixed(4)),
          publisher_earnings: parseFloat(publisherEarnings.toFixed(4)),
          platform_earnings: parseFloat(platformEarnings.toFixed(4)),
          revenue_share_pct: siteInfo.revenueSharePct,
        }
      }).sort((a, b) => b.impressions - a.impressions)

      return NextResponse.json({
        role: 'admin',
        period: { startDate, endDate, days: parseInt(period) },
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          revenue_usd: parseFloat(totals.revenue.toFixed(4)),
          revenue_inr: parseFloat((totals.revenue * 83).toFixed(2)),
          publisher_earnings_usd: parseFloat(domains.reduce((s, d) => s + d.publisher_earnings, 0).toFixed(4)),
          platform_earnings_usd: parseFloat(domains.reduce((s, d) => s + d.platform_earnings, 0).toFixed(4)),
          cpm: totals.impressions > 0 ? parseFloat(((totals.revenue / totals.impressions) * 1000).toFixed(4)) : 0,
          ctr: totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
        },
        chartData,
        domains,
        network: 'Adsterra',
      })

    } else {
      // ── PUBLISHER VIEW ──────────────────────────────────────────
      const { data: publisherSites } = await admin
        .from('sites')
        .select('site_url, name, adsterra_domain_id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (!publisherSites?.length) {
        return NextResponse.json({ role: 'publisher', no_site: true })
      }

      const { data: publisherAd } = await admin
        .from('publisher_ads')
        .select('revenue_share_pct')
        .eq('publisher_id', user.id)
        .limit(1)
        .single()

      const revenueSharePct = publisherAd?.revenue_share_pct || 70

      // Build set of adsterra domain IDs for this publisher
      const publisherAdsterraDomainIds = new Set(
        (publisherSites || [])
          .filter(s => s.adsterra_domain_id)
          .map(s => String(s.adsterra_domain_id))
      )

      const [domainStats, dateStats] = await Promise.all([
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`, apiKey),
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`, apiKey),
      ])

      // Match only this publisher's domains using adsterra_domain_id
      const matchedStats = (domainStats.items || []).filter((d: Record<string, unknown>) => {
        const rawId = String(d.domain ?? d.domain_id ?? d.id ?? '')
        return publisherAdsterraDomainIds.has(rawId)
      })

      const publisherTotals = matchedStats.reduce((acc: {
        impressions: number; clicks: number; revenue: number
      }, d: Record<string, unknown>) => {
        const parsed = parseItem(d)
        return {
          impressions: acc.impressions + parsed.impressions,
          clicks: acc.clicks + parsed.clicks,
          revenue: acc.revenue + parsed.revenue,
        }
      }, { impressions: 0, clicks: 0, revenue: 0 })

      const grossRevenue = publisherTotals.revenue
      const publisherEarnings = grossRevenue * (revenueSharePct / 100)

      // Fetch publisher's domain stats grouped by date for accurate daily breakdown
const publisherDateStats = await fetchAdsterra(
  `stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date&domain=${Array.from(publisherAdsterraDomainIds).join(',')}`,
  apiKey
)

// Use domain-filtered date stats if available, else scale from network
const dailyItems: Record<string, unknown>[] = publisherDateStats.items?.length
  ? publisherDateStats.items
  : (dateStats.items || [])

const fullNetworkImpressions = (dateStats.items || []).reduce(
  (s: number, d: Record<string, unknown>) => s + Number(parseItem(d).impressions), 0
)
const shareRatio = fullNetworkImpressions > 0 && !publisherDateStats.items?.length
  ? publisherTotals.impressions / fullNetworkImpressions
  : 1

const chartData = dailyItems.map((item: Record<string, unknown>) => {
  const parsed = parseItem(item)
  return {
    date: parsed.date,
    impressions: Math.round(parsed.impressions * shareRatio),
    clicks: Math.round(parsed.clicks * shareRatio),
    earnings: parseFloat((parsed.revenue * shareRatio * (revenueSharePct / 100)).toFixed(4)),
  }
})

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
            ? parseFloat(((grossRevenue / publisherTotals.impressions) * 1000).toFixed(4)) : 0,
          ctr: publisherTotals.impressions > 0
            ? parseFloat(((publisherTotals.clicks / publisherTotals.impressions) * 100).toFixed(2)) : 0,
        },
        chartData,
        network: 'Ad Network',
      })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
