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
// Note: feedburner redirects fail on Cloudflare edge; use direct feeds
const RSS_FEEDS: Record<string, string[]> = {
  in: [
    'https://www.thehindu.com/feeder/default.rss',
    'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
  ],
  us: [
    'https://feeds.npr.org/1001/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  ],
  gb: [
    'https://feeds.bbci.co.uk/news/rss.xml',
  ],
  '': [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://feeds.reuters.com/reuters/topNews',
  ],
}

const SOURCE_NAMES: Record<string, string[]> = {
  in: ['The Hindu', 'Times of India'],
  us: ['NPR', 'NY Times'],
  gb: ['BBC News'],
  '': ['BBC World', 'Reuters'],
}

async function fetchRSS(country: string): Promise<{ title: string; description: string; source: string; flag: string; region: string }[]> {
  const urls = RSS_FEEDS[country] || RSS_FEEDS['']
  const sources = SOURCE_NAMES[country] || SOURCE_NAMES['']
  const regionMap: Record<string, { label: string; flag: string }> = {
    in: { label: 'India', flag: '🇮🇳' },
    us: { label: 'United States', flag: '🇺🇸' },
    gb: { label: 'United Kingdom', flag: '🇬🇧' },
    '': { label: 'Global', flag: '🌍' },
  }
  const info = regionMap[country] || { label: 'Global', flag: '🌍' }
  const results: { title: string; description: string; source: string; flag: string; region: string }[] = []

  for (let i = 0; i < urls.length; i++) {
    if (results.length >= 10) break
    try {
      const res = await fetch(urls[i], {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
      const parsed = items.slice(0, 8).map(item => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
        const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || ''
        return {
          title: title.replace(/ - .*$/, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
          description: desc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').slice(0, 150),
          source: sources[i] || 'News',
          flag: info.flag,
          region: info.label,
        }
      }).filter(a => a.title && a.title.length > 10)
      results.push(...parsed)
    } catch { continue }
  }
  return results
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

async function fetchGeminiTrends(regions: string[], geminiKey: string): Promise<{ items: unknown[]; error?: string }> {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  // Try models in order until one works
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
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
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`
        // If model deprecated/not found, try next model
        if (msg.includes('no longer available') || msg.includes('not found') || res.status === 404) continue
        return { items: [], error: `Gemini ${model}: ${msg}` }
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const match = text.replace(/```json\n?|```/g, '').match(/\[[\s\S]*\]/)
      return { items: match ? JSON.parse(match[0]) : [] }
    } catch (e) { return { items: [], error: String(e) } }
  }
  return { items: [], error: 'All Gemini models unavailable' }
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
  // Prefer the platform env key for trends — it's server-side and always valid.
  // Fall back to user's own key only if env key not set.
  const geminiKey = process.env.GEMINI_API_KEY || profile?.byoak_gemini_key || ''

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

  // 2. RSS fallback (always free, no key needed)
  if (allTrends.length < 5) {
    // Fetch RSS for each unique country code
    const countryCodes = [...new Set(regionsToFetch.map(r => REGIONS_MAP[r]?.gnewsCountry ?? ''))]
    for (const code of countryCodes) {
      try {
        const articles = await fetchRSS(code)
        for (const a of articles) {
          allTrends.push({ title: a.title, description: a.description, category: 'News', region: a.region, flag: a.flag, source: a.source })
        }
      } catch { /* continue */ }
    }
  }

  // 3. Gemini AI — always try if key available (primary source when RSS fails)
  let geminiError = ''
  if (geminiKey) {
    try {
      const { items: geminiTrends, error: gErr } = await fetchGeminiTrends(regionsToFetch, geminiKey)
      if (gErr) geminiError = gErr
      for (const t of (geminiTrends as { title?: string; description?: string; category?: string; region?: string; flag?: string }[])) {
        if (t.title) {
          const info = REGIONS_MAP[t.region || ''] || { label: t.region || 'Global', flag: t.flag || '🌍' }
          allTrends.push({ title: t.title, description: t.description || '', category: t.category || 'General', region: info.label, flag: info.flag, source: 'AI' })
        }
      }
    } catch (e) { geminiError = String(e) }
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
    return NextResponse.json({ error: 'FREE_PLAN_NO_KEY', trends: [], total: 0, debug: geminiError || 'RSS and Gemini both returned empty' })
  }

  return NextResponse.json({ trends: unique, total: unique.length, source: gnewsKey ? 'gnews' : 'rss', timestamp: new Date().toISOString() })
}
