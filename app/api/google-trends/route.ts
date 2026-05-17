import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REGIONS = [
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { code: '', label: 'Global', flag: '🌍' },
]

async function fetchTrendsRSS(geo: string): Promise<{ title: string; description: string; pubDate: string; region: string; flag: string }[]> {
  const url = geo
    ? `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`
    : `https://trends.google.com/trends/trendingsearches/daily/rss`

  const region = REGIONS.find(r => r.code === geo) || { label: 'Global', flag: '🌍' }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendingVerse/1.0)' },
      next: { revalidate: 1800 } // cache 30 min
    })
    if (!res.ok) return []
    const xml = await res.text()

    // Parse RSS XML manually
    const items: { title: string; description: string; pubDate: string; region: string; flag: string }[] = []
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || []

    for (const item of itemMatches.slice(0, 10)) {
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                    item.match(/<title>(.*?)<\/title>/)?.[1] || ''
      const description = item.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] ||
                          item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || ''
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''

      if (title) {
        items.push({
          title: title.trim(),
          description: description.replace(/<[^>]+>/g, '').trim(),
          pubDate: pubDate.trim(),
          region: region.label,
          flag: region.flag,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'

  try {
    let trends: { title: string; description: string; pubDate: string; region: string; flag: string }[] = []

    if (region === 'ALL') {
      // Fetch all regions in parallel
      const results = await Promise.all(REGIONS.map(r => fetchTrendsRSS(r.code)))
      trends = results.flat()
    } else {
      const r = REGIONS.find(x => x.label === region || x.code === region)
      trends = await fetchTrendsRSS(r?.code || 'IN')
    }

    // Deduplicate by title
    const seen = new Set<string>()
    const unique = trends.filter(t => {
      const key = t.title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ trends: unique, total: unique.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
