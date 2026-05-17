import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || 'India'
  const geminiKey = process.env.GEMINI_API_KEY
  const newsApiKey = process.env.NEWS_API_KEY

  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  const REGIONS: Record<string, { label: string; flag: string; newsCode: string }> = {
    'India': { label: 'India', flag: '🇮🇳', newsCode: 'in' },
    'United States': { label: 'United States', flag: '🇺🇸', newsCode: 'us' },
    'United Kingdom': { label: 'United Kingdom', flag: '🇬🇧', newsCode: 'gb' },
    'Global': { label: 'Global', flag: '🌍', newsCode: '' },
    'ALL': { label: 'All', flag: '🌐', newsCode: '' },
  }

  const regionsToFetch = region === 'ALL'
    ? ['India', 'United States', 'United Kingdom', 'Global']
    : [region]

  const allTrends: { title: string; description: string; category: string; region: string; flag: string; source: string }[] = []

  // Try NewsAPI first if key exists
  if (newsApiKey) {
    try {
      for (const r of regionsToFetch) {
        const info = REGIONS[r] || { label: r, flag: '🌍', newsCode: '' }
        const countryParam = info.newsCode ? `country=${info.newsCode}` : 'language=en'
        const url = `https://newsapi.org/v2/top-headlines?${countryParam}&pageSize=8&apiKey=${newsApiKey}`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          for (const a of data.articles || []) {
            if (a.title && a.title !== '[Removed]') {
              allTrends.push({
                title: a.title.replace(/ [-|] [^-|]+$/, '').trim(),
                description: a.description || '',
                category: 'News',
                region: info.label,
                flag: info.flag,
                source: a.source?.name || 'NewsAPI',
              })
            }
          }
        }
      }
    } catch (e) {
      console.error('NewsAPI error:', e)
    }
  }

  // Use Gemini if no results yet
  // Use Gemini for regions where NewsAPI doesn't have data (India, UK, Global)
const geminiRegions = regionsToFetch.filter(r =>
  !allTrends.some(t => t.region === (REGIONS[r]?.label || r))
)

if (geminiRegions.length > 0) {
    try {
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      const regionList = geminiRegions.join(', ')

      const prompt = `Today is ${today}. List 12 real current trending news topics for ${regionList}.
Include mix of: politics, technology, sports, entertainment, business.
Return ONLY a JSON array, nothing else:
[{"title":"Specific trending news headline","description":"One sentence context","category":"Technology","region":"India","flag":"🇮🇳"}]
Use these flags: India=🇮🇳 US=🇺🇸 UK=🇬🇧 Global=🌍`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 1, maxOutputTokens: 2048 }
          }),
          cache: 'no-store'
        }
      )

      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({ error: 'Gemini API error: ' + (err.error?.message || res.statusText), trends: [], total: 0 })
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const match = text.match(/\[[\s\S]*?\]/)

      if (match) {
        const parsed = JSON.parse(match[0])
        for (const t of parsed) {
          if (t.title) {
            allTrends.push({
              title: t.title,
              description: t.description || t.summary || '',
              category: t.category || 'General',
              region: t.region || region,
              flag: t.flag || '🌍',
              source: 'Gemini AI',
            })
          }
        }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Trends fetch failed: ' + (e as Error).message, trends: [], total: 0 })
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

  return NextResponse.json({ trends: unique, total: unique.length, source: newsApiKey ? 'newsapi' : 'gemini' })
}
