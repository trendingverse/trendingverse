export const runtime = 'edge'
// This replaces app/api/google-trends/route.ts
// Uses GNews API (free, works on Vercel) with Gemini fallback

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const REGIONS_MAP: Record<string, { label: string; flag: string; gnewsLang: string; gnewsCountry: string }> = {
  'India':          { label: 'India',         flag: '🇮🇳', gnewsLang: 'en', gnewsCountry: 'in' },
  'United States':  { label: 'United States', flag: '🇺🇸', gnewsLang: 'en', gnewsCountry: 'us' },
  'United Kingdom': { label: 'United Kingdom',flag: '🇬🇧', gnewsLang: 'en', gnewsCountry: 'gb' },
  'Global':         { label: 'Global',        flag: '🌍', gnewsLang: 'en', gnewsCountry: '' },
}

// Free fallback: Google News RSS (no API key, works on edge)
async function fetchGoogleNewsRSS(country: string): Promise<{ title: string; description: string; source: string; flag: string; region: string }[]> {
  const geo = country === 'in' ? 'IN:en' : country === 'us' ? 'US:en' : country === 'gb' ? 'GB:en' : 'US:en'
  const url = `https://news.google.com/rss?hl=en-IN&gl=${geo.split(':')[0]}&ceid=${geo}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    const regionMap: Record<string, { label: string; flag: string }> = {
      in: { label: 'India', flag: '🇮🇳' },
      us: { label: 'United States', flag: '🇺🇸' },
      gb: { label: 'United Kingdom', flag: '🇬🇧' },
      '': { label: 'Global', flag: '🌍' },
    }
    const info = regionMap[country] || { label: 'Global', flag: '🌍' }
    return items.slice(0, 12).map(item => {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || ''
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || ''
      const src = (item.match(/<source[^>]*>(.*?)<\/source>/))?.[1] || 'Google News'
      return { title: title.replace(/ - .*$/, '').trim(), description: desc.replace(/<[^>]+>/g, '').slice(0, 150), source: src, flag: info.flag, region: info.label }
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

async function fetchGeminiTrends(regions: string[], groqKey: string) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const res = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
messages: [{ role: 'user', content: `Today is ${today}. List 15 specific trending news headlines from ${regions.join(', ')} happening RIGHT NOW. Be specific — real names, real events. Mix politics, tech, sports, entertainment, business.
Return ONLY JSON array:
[{"title":"Specific headline","description":"One sentence","category":"Politics","region":"India","flag":"🇮🇳"}]
Flags: India=🇮🇳 US=🇺🇸 UK=🇬🇧 Global=🌍` }],
temperature: 0.7,
max_tokens: 2048,
      }),
      cache: 'no-store'
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const match = text.replace(/```json\n?|```/g, '').match(/\[[\s\S]*\]/)
  try { return match ? JSON.parse(match[0]) : [] } catch { return [] }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Read API keys from user_profiles (edge-compatible) with env var fallback
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('byoak_gemini_key')
    .eq('id', user.id)
    .single()

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'
  const gnewsKey = process.env.GNEWS_API_KEY || ''
  const groqKey = process.env.GROQ_API_KEY

  const regionsToFetch = region === 'ALL'
    ? ['India', 'United States', 'United Kingdom', 'Global']
    : [region]

  const allTrends: { title: string; description: string; category: string; region: string; flag: string; source: string }[] = []

  // Try GNews first (works on Vercel, real-time)
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

  // Google News RSS fallback (free, no API key needed)
  if (allTrends.length === 0) {
    for (const r of regionsToFetch) {
      const info = REGIONS_MAP[r] || { label: r, flag: '🌍', gnewsLang: 'en', gnewsCountry: '' }
      try {
        const articles = await fetchGoogleNewsRSS(info.gnewsCountry)
        for (const a of articles) {
          allTrends.push({ title: a.title, description: a.description, category: 'News', region: a.region, flag: a.flag, source: a.source })
        }
      } catch { /* continue */ }
    }
  }

  // Groq supplement (AI-generated trends)
  if (groqKey) {
    try {
      const geminiTrends = await fetchGeminiTrends(regionsToFetch, groqKey)
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

  if (unique.length === 0 && !groqKey) {
    return NextResponse.json({ error: 'FREE_PLAN_NO_KEY', trends: [], total: 0 })
  }

  return NextResponse.json({ trends: unique, total: unique.length, source: gnewsKey ? 'gnews+gemini' : 'gemini', timestamp: new Date().toISOString() })
}
