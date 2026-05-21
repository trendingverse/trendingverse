import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GNews API - works on Vercel, free tier = 100 req/day
async function fetchGNews(query: string, lang: string, apiKey: string) {
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&country=in&max=10&sortby=publishedAt&apikey=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.articles || []).map((a: { title: string; description: string; source: { name: string } }) => ({
    title: a.title?.replace(/ - .*$/, '').trim(),
    description: a.description || '',
    source: a.source?.name || '',
  })).filter((a: { title: string }) => a.title && a.title.length > 10)
}

// MediaStack API - works on Vercel, free tier = 500 req/month
async function fetchMediaStack(apiKey: string) {
  const url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&countries=in&languages=en&limit=10&sort=published_desc`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data || []).map((a: { title: string; description: string; source: string }) => ({
    title: a.title?.replace(/ - .*$/, '').trim(),
    description: a.description || '',
    source: a.source || '',
  })).filter((a: { title: string }) => a.title && a.title.length > 10)
}

// Gemini with today's date - forces it to think about current events
async function fetchGeminiTrends(regions: string[], geminiKey: string) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const regionList = regions.join(', ')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Today is ${today}.

List 15 real, specific trending news headlines from ${regionList} that are making headlines RIGHT NOW today.
Focus on: breaking news, viral stories, politics, sports results, technology launches, business news, entertainment.
Be specific — use real names, real events, real numbers.
Mix of regions: India, US, UK, Global.

Return ONLY a JSON array, no other text:
[
  {"title":"Specific real headline happening today","description":"One sentence context with specific details","category":"Politics","region":"India","flag":"🇮🇳"},
  {"title":"Another specific real headline","description":"Context","category":"Technology","region":"Global","flag":"🌍"}
]

Use flags: India=🇮🇳 US=🇺🇸 UK=🇬🇧 Global=🌍` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
      cache: 'no-store'
    }
  )

  if (!res.ok) return []
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('').replace(/```json\n?|```/g, '').trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

const REGIONS_MAP: Record<string, { label: string; flag: string }> = {
  'India': { label: 'India', flag: '🇮🇳' },
  'United States': { label: 'United States', flag: '🇺🇸' },
  'United Kingdom': { label: 'United Kingdom', flag: '🇬🇧' },
  'Global': { label: 'Global', flag: '🌍' },
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'ALL'
  const geminiKey = process.env.GEMINI_API_KEY
  const geminiKey2 = process.env.GEMINI_API_KEY_2
  const gnewsKey = process.env.GNEWS_API_KEY
  const mediastackKey = process.env.MEDIASTACK_API_KEY

  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  const regionsToFetch = region === 'ALL'
    ? ['India', 'United States', 'United Kingdom', 'Global']
    : [region]

  let allTrends: { title: string; description: string; category: string; region: string; flag: string; source: string }[] = []

  // Try GNews API first (works on Vercel)
  if (gnewsKey) {
    try {
      const articles = await fetchGNews('India news today', 'en', gnewsKey)
      for (const a of articles) {
        if (a.title) {
          allTrends.push({
            title: a.title,
            description: a.description,
            category: 'News',
            region: 'India',
            flag: '🇮🇳',
            source: a.source,
          })
        }
      }
    } catch { /* fallback */ }
  }

  // Try MediaStack (works on Vercel)
  if (mediastackKey && allTrends.length < 5) {
    try {
      const articles = await fetchMediaStack(mediastackKey)
      for (const a of articles) {
        if (a.title) {
          allTrends.push({
            title: a.title,
            description: a.description,
            category: 'News',
            region: 'India',
            flag: '🇮🇳',
            source: a.source,
          })
        }
      }
    } catch { /* fallback */ }
  }

  // Use Gemini for remaining regions or as fallback
  const activeKey = geminiKey2 || geminiKey
  try {
    const geminiTrends = await fetchGeminiTrends(regionsToFetch, activeKey)
    for (const t of geminiTrends) {
      if (t.title) {
        const regionInfo = REGIONS_MAP[t.region] || { label: t.region || 'Global', flag: t.flag || '🌍' }
        allTrends.push({
          title: t.title,
          description: t.description || '',
          category: t.category || 'General',
          region: regionInfo.label,
          flag: regionInfo.flag,
          source: 'AI',
        })
      }
    }
  } catch { /* ignore */ }

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
    source: gnewsKey ? 'gnews' : mediastackKey ? 'mediastack' : 'gemini',
    timestamp: new Date().toISOString(),
  })
}
