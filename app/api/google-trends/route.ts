import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fetch trending news from NewsAPI (free tier - 100 req/day)
async function fetchNewsAPITrends(country: string, category: string, apiKey: string) {
  const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=5&apiKey=${apiKey}`
  const res = await fetch(url, { next: { revalidate: 1800 } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.articles || []).map((a: { title: string; description: string; source: { name: string } }) => ({
    title: a.title?.replace(/ - .*$/, '') || '',
    description: a.description || '',
    source: a.source?.name || '',
  })).filter((a: { title: string }) => a.title && a.title !== '[Removed]')
}

// Fallback: Use Gemini to generate trending topics with today's date context
async function fetchGeminiTrends(region: string, apiKey: string) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const prompt = `Today is ${today}. List 10 real trending news topics right now for ${region}.
Focus on: politics, technology, entertainment, sports, business, health.
Return ONLY valid JSON array:
[{"title":"exact trending topic or news headline","description":"one sentence summary","category":"Technology","traffic":"High"}]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.match(/\[[\s\S]*\]/)
  try { return match ? JSON.parse(match[0]) : [] } catch { return [] }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'

  const newsApiKey = process.env.NEWS_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  const REGIONS = [
    { code: 'in', label: 'India', flag: '🇮🇳', gemini: 'India' },
    { code: 'us', label: 'United States', flag: '🇺🇸', gemini: 'United States' },
    { code: 'gb', label: 'United Kingdom', flag: '🇬🇧', gemini: 'United Kingdom' },
    { code: '', label: 'Global', flag: '🌍', gemini: 'Global worldwide' },
  ]

  const categories = ['general', 'technology', 'business', 'entertainment', 'sports', 'health']

  try {
    let allTrends: { title: string; description: string; category: string; region: string; flag: string; source: string }[] = []

    if (newsApiKey) {
      // Use NewsAPI for real headlines
      const regionsToFetch = region === 'ALL' ? REGIONS.filter(r => r.code) : REGIONS.filter(r => r.label === region || r.code === region.toLowerCase())

      for (const r of regionsToFetch) {
        if (!r.code) continue
        // Fetch across multiple categories
        for (const cat of categories.slice(0, 3)) {
          const articles = await fetchNewsAPITrends(r.code, cat, newsApiKey)
          for (const a of articles) {
            if (a.title) {
              allTrends.push({
                title: a.title,
                description: a.description,
                category: cat.charAt(0).toUpperCase() + cat.slice(1),
                region: r.label,
                flag: r.flag,
                source: a.source,
              })
            }
          }
        }
      }

      // For Global, fetch without country
      if (region === 'ALL' || region === 'Global') {
        for (const cat of ['general', 'technology', 'business']) {
          const url = `https://newsapi.org/v2/top-headlines?language=en&category=${cat}&pageSize=5&apiKey=${newsApiKey}`
          const res = await fetch(url, { next: { revalidate: 1800 } })
          if (res.ok) {
            const data = await res.json()
            for (const a of data.articles || []) {
              if (a.title && a.title !== '[Removed]') {
                allTrends.push({
                  title: a.title.replace(/ - .*$/, ''),
                  description: a.description || '',
                  category: cat.charAt(0).toUpperCase() + cat.slice(1),
                  region: 'Global',
                  flag: '🌍',
                  source: a.source?.name || '',
                })
              }
            }
          }
        }
      }
    }

    // If no NewsAPI key or no results, fallback to Gemini
    if (allTrends.length === 0 && geminiKey) {
      const regionsToUse = region === 'ALL'
        ? ['India', 'United States', 'United Kingdom', 'Global']
        : [region]

      for (const r of regionsToUse) {
        const topics = await fetchGeminiTrends(r, geminiKey)
        const regionInfo = REGIONS.find(x => x.label === r || x.gemini === r) || { label: r, flag: '🌍' }
        for (const t of topics) {
          allTrends.push({
            title: t.title,
            description: t.description || t.summary || '',
            category: t.category || 'General',
            region: regionInfo.label,
            flag: regionInfo.flag,
            source: 'AI',
          })
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    const unique = allTrends.filter(t => {
      const key = t.title.toLowerCase().slice(0, 40)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({
      trends: unique,
      total: unique.length,
      source: newsApiKey ? 'newsapi' : 'gemini'
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
