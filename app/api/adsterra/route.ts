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

// Adsterra returns numeric IDs — fetch domains list to map ID → name
async function fetchDomainMap(apiKey: string): Promise<Record<string, string>> {
  try {
    const res = await fetch('https://api3.adsterratools.com/publisher/domains.json', {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, string> = {}
    const items = data.items || data.domains || data || []
    for (const d of Array.isArray(items) ? items : []) {
      const id = String(d.id ?? d.domain_id ?? '')
      // Try every possible URL field
      const url = d.url ?? d.site_url ?? d.domain ?? d.name ?? d.website ?? ''
      if (id && url) map[id] = String(url).replace(/^https?:\/\//, '').replace(/\/$/, '')
    }
    return map
  } catch { return {} }
}

function parseItem(item: Record<string, unknown>) {
  // Adsterra uses various field names — try all possibilities
 const impressions = Number(
  item.impression ?? item.impressions ?? item.views ?? 0
)
  const clicks = Number(item.clicks ?? 0)
  const ctr = parseFloat(String(item.ctr ?? 0))
  const cpm = parseFloat(String(item.cpm ?? 0))
  const revenue = parseFloat(String(item.revenue ?? item.earnings ?? 0))

  // Date field — Adsterra may use date, day, or start_date
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

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Fetch domain ID → URL mapping
    const domainMap = await fetchDomainMap(apiKey)

    if (isAdmin) {
      const [dateStats, domainStats] = await Promise.all([
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`, apiKey),
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`, apiKey),
      ])

      // Debug mode — return raw data
      if (debug) {
        const domainsRaw = await fetchAdsterra('domains.json', apiKey).catch(e => ({ error: e.message }))
  return NextResponse.json({

       
          debug: true,
          domainMap,
          dateStats_first: dateStats.items?.[0],
          domainStats_first: domainStats.items?.[0],
          all_date_keys: dateStats.items?.[0] ? Object.keys(dateStats.items[0]) : [],
          all_domain_keys: domainStats.items?.[0] ? Object.keys(domainStats.items[0]) : [],
        })
      }

      const { data: sites } = await admin.from('sites').select('site_url, name, user_id')
      const { data: publisherAds } = await admin.from('publisher_ads').select('publisher_id, revenue_share_pct, sites(site_url)')

      // Build domain → publisher map using both URL and numeric ID
      const domainPublisherMap: Record<string, { siteName: string; revenueSharePct: number }> = {}
      for (const site of sites || []) {
        const siteClean = String(site.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
        const pa = (publisherAds || []).find((p: { sites: unknown }) => {
          const siteUrl = (p.sites as { site_url?: string } | null)?.site_url || ''
          return String(siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, '') === siteClean
        })
        domainPublisherMap[siteClean] = {
          siteName: site.name || siteClean,
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
        // Domain might be numeric ID — look up real URL
        const rawDomain = String(d.domain ?? d.domain_id ?? d.id ?? 'Unknown')
        const realUrl = domainMap[rawDomain] || rawDomain

        const siteClean = realUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        const publisherInfo = domainPublisherMap[siteClean] || { siteName: siteClean, revenueSharePct: 70 }
        const parsed = parseItem(d)
        const grossRevenue = parsed.revenue
        const publisherEarnings = grossRevenue * (publisherInfo.revenueSharePct / 100)
        const platformEarnings = grossRevenue * ((100 - publisherInfo.revenueSharePct) / 100)

        return {
          domain: realUrl,
          site_name: publisherInfo.siteName,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
          ctr: parseFloat(parsed.ctr.toFixed(2)),
          cpm: parseFloat(parsed.cpm.toFixed(4)),
          gross_revenue: parseFloat(grossRevenue.toFixed(4)),
          publisher_earnings: parseFloat(publisherEarnings.toFixed(4)),
          platform_earnings: parseFloat(platformEarnings.toFixed(4)),
          revenue_share_pct: publisherInfo.revenueSharePct,
        }
      }).sort((a, b) => b.clicks - a.clicks) // sort by clicks since revenue is 0

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
          ctr: totals.clicks > 0 ? parseFloat(((totals.clicks / Math.max(totals.impressions, totals.clicks)) * 100).toFixed(2)) : 0,
        },
        chartData,
        domains,
        network: 'Adsterra',
      })

    } else {
      // Publisher view
      const { data: publisherSites } = await admin.from('sites').select('site_url, name').eq('user_id', user.id).eq('is_active', true)
      if (!publisherSites?.length) return NextResponse.json({ role: 'publisher', no_site: true })

      const { data: publisherAd } = await admin.from('publisher_ads').select('revenue_share_pct').eq('publisher_id', user.id).limit(1).single()
      const revenueSharePct = publisherAd?.revenue_share_pct || 70

      const [domainStats, dateStats] = await Promise.all([
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=domain`, apiKey),
        fetchAdsterra(`stats.json?start_date=${startDate}&finish_date=${endDate}&group_by=date`, apiKey),
      ])

      const publisherDomains = (publisherSites || []).map(s =>
        String(s.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      )

      const matchedStats = (domainStats.items || []).filter((d: Record<string, unknown>) => {
        const rawDomain = String(d.domain ?? d.domain_id ?? d.id ?? '')
        const realUrl = (domainMap[rawDomain] || rawDomain).replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
        return publisherDomains.some(pd => realUrl.includes(pd) || pd.includes(realUrl))
      })

      const publisherTotals = matchedStats.reduce((acc: { impressions: number; clicks: number; revenue: number }, d: Record<string, unknown>) => {
        const parsed = parseItem(d)
        return { impressions: acc.impressions + parsed.impressions, clicks: acc.clicks + parsed.clicks, revenue: acc.revenue + parsed.revenue }
      }, { impressions: 0, clicks: 0, revenue: 0 })

      const grossRevenue = publisherTotals.revenue
      const publisherEarnings = grossRevenue * (revenueSharePct / 100)

      const chartData = (dateStats.items || []).map((item: Record<string, unknown>) => {
        const parsed = parseItem(item)
        return {
          date: parsed.date,
          impressions: parsed.impressions,
          clicks: parsed.clicks,
          earnings: parseFloat((parsed.revenue * (revenueSharePct / 100)).toFixed(4)),
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
          cpm: publisherTotals.impressions > 0 ? parseFloat(((grossRevenue / publisherTotals.impressions) * 1000).toFixed(4)) : 0,
          ctr: publisherTotals.impressions > 0 ? parseFloat(((publisherTotals.clicks / publisherTotals.impressions) * 100).toFixed(2)) : 0,
        },
        chartData,
        network: 'Ad Network',
      })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
