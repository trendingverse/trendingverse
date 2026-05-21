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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Today is ${today}. List 15 specific trending news headlines from ${regions.join(', ')} happening RIGHT NOW. Be specific — real names, real events. Mix politics, tech, sports, entertainment, business.
Return ONLY JSON array:
[{"title":"Specific headline","description":"One sentence","category":"Politics","region":"India","flag":"🇮🇳"}]
Flags: India=🇮🇳 US=🇺🇸 UK=🇬🇧 Global=🌍` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
      cache: 'no-store'
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.replace(/```json\n?|```/g, '').match(/\[[\s\S]*\]/)
  try { return match ? JSON.parse(match[0]) : [] } catch { return [] }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'
  const gnewsKey = process.env.GNEWS_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY

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

  // Gemini fallback or supplement
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

  return NextResponse.json({ trends: unique, total: unique.length, source: gnewsKey ? 'gnews+gemini' : 'gemini', timestamp: new Date().toISOString() })
}
