export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REGIONS_MAP: Record<string, { label: string; flag: string; gnewsLang: string; gnewsCountry: string }> = {
  'India':          { label: 'India',         flag: '🇮🇳', gnewsLang: 'en', gnewsCountry: 'in' },
  'United States':  { label: 'United States', flag: '🇺🇸', gnewsLang: 'en', gnewsCountry: 'us' },
  'United Kingdom': { label: 'United Kingdom',flag: '🇬🇧', gnewsLang: 'en', gnewsCountry: 'gb' },
  'Global':         { label: 'Global',        flag: '🌍', gnewsLang: 'en', gnewsCountry: '' },
}

// Free RSS feeds — no API key, works on edge
const RSS_FEEDS: Record<string, string> = {
  in: 'https://feeds.feedburner.com/ndtvnews-top-stories',
  us: 'https://feeds.npr.org/1001/rss.xml',
  gb: 'https://feeds.bbci.co.uk/news/rss.xml',
  '': 'https://feeds.bbci.co.uk/news/world/rss.xml',
}

async function fetchRSS(country: string): Promise<{ title: string; description: string; source: string; flag: string; region: string }[]> {
  const url = RSS_FEEDS[country] || RSS_FEEDS['']
  const regionMap: Record<string, { label: string; flag: string }> = {
    in: { label: 'India', flag: '🇮🇳' },
    us: { label: 'United States', flag: '🇺🇸' },
    gb: { label: 'United Kingdom', flag: '🇬🇧' },
    '': { label: 'Global', flag: '🌍' },
  }
  const info = regionMap[country] || { label: 'Global', flag: '🌍' }
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    return items.slice(0, 10).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || ''
      return {
        title: title.replace(/ - .*$/, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
        description: desc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').slice(0, 150),
        source: country === 'in' ? 'NDTV' : country === 'us' ? 'NPR' : 'BBC News',
        flag: info.flag,
        region: info.label,
      }
    }).filter(a => a.title && a.title.length > 10)
  } catch { return [] }
}

async function fetchGNews(country: string, lang: string, apiKey: string) {
  const countryParam = country ? `&country=${country}` : ''
  const url = `https://gnews.io/api/v4/top-headlines?lang=${lang}${countryParam}&max=10&apikey=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.articles || []).map((a: { title: string; description: string; source: { name: string } }) => ({
    title: a.title?.replace(/ - .*$/, '').trim(),
    description: a.description || '',
    source: a.source?.name || 'GNews',
  })).filter((a: { title: string }) => a.title && a.title.length > 15)
}

async function fetchGeminiTrends(regions: string[], geminiKey: string) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Today is ${today}. List 15 specific trending news headlines from ${regions.join(', ')} happening RIGHT NOW. Be specific — real names, real events. Mix politics, tech, sports, entertainment, business.
Return ONLY JSON array:
[{"title":"Specific headline","description":"One sentence","category":"Politics","region":"India","flag":"🇮🇳"}]
Flags: India=🇮🇳 US=🇺🇸 UK=🇬🇧 Global=🌍` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        cache: 'no-store'
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = text.replace(/```json\n?|```/g, '').match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('byoak_gemini_key')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'
  const gnewsKey = process.env.GNEWS_API_KEY || ''
  const geminiKey = profile?.byoak_gemini_key || process.env.GEMINI_API_KEY || ''

  const regionsToFetch = region === 'ALL'
    ? ['India', 'United States', 'United Kingdom', 'Global']
    : [region]

  const allTrends: { title: string; description: string; category: string; region: string; flag: string; source: string }[] = []

  // 1. GNews (if key set)
  if (gnewsKey) {
    for (const r of regionsToFetch) {
      const info = REGIONS_MAP[r] || { label: r, flag: '🌍', gnewsLang: 'en', gnewsCountry: '' }
      try {
        const articles = await fetchGNews(info.gnewsCountry, info.gnewsLang, gnewsKey)
        for (const a of articles) {
          if (a.title) allTrends.push({ title: a.title, description: a.description, category: 'News', region: info.label, flag: info.flag, source: a.source })
        }
      } catch { /* continue */ }
    }
  }

  // 2. RSS fallback (always free, no key)
  if (allTrends.length === 0) {
    for (const r of regionsToFetch) {
      const info = REGIONS_MAP[r] || { label: r, flag: '🌍', gnewsLang: 'en', gnewsCountry: '' }
      try {
        const articles = await fetchRSS(info.gnewsCountry)
        for (const a of articles) {
          allTrends.push({ title: a.title, description: a.description, category: 'News', region: a.region, flag: a.flag, source: a.source })
        }
      } catch { /* continue */ }
    }
  }

  // 3. Gemini AI supplement (if key available)
  if (geminiKey) {
    try {
      const geminiTrends = await fetchGeminiTrends(regionsToFetch, geminiKey)
      for (const t of geminiTrends) {
        if (t.title) {
          const info = REGIONS_MAP[t.region] || { label: t.region || 'Global', flag: t.flag || '🌍' }
          allTrends.push({ title: t.title, description: t.description || '', category: t.category || 'General', region: info.label, flag: info.flag, source: 'AI' })
        }
      }
    } catch { /* ignore */ }
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique = allTrends.filter(t => {
    const key = t.title.toLowerCase().slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) {
    return NextResponse.json({ error: 'FREE_PLAN_NO_KEY', trends: [], total: 0 })
  }

  return NextResponse.json({ trends: unique, total: unique.length, source: gnewsKey ? 'gnews' : 'rss', timestamp: new Date().toISOString() })
}
