// app/api/admin/seo-fix-author/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' }

// Category → Author mapping
const USMAN_CATEGORIES   = ['politics', 'business', 'finance', 'india', 'world', 'crime']
const AIZAL_CATEGORIES   = ['technology', 'entertainment', 'sports', 'health', 'science', 'lifestyle', 'trending', 'education', 'environment']

const CATEGORIES = [
  'Politics', 'Business', 'Technology', 'Sports', 'Entertainment',
  'Health', 'Science', 'Education', 'World', 'India', 'Lifestyle',
  'Finance', 'Crime', 'Environment', 'Trending'
]

async function wpGet(path: string) {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2${path}`, { headers: WP_HEADERS })
  if (!res.ok) return null
  return res.json()
}

async function wpPost(path: string, body: object) {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2${path}`, {
    method: 'POST', headers: WP_HEADERS, body: JSON.stringify(body),
  })
  return { ok: res.ok, data: res.ok ? await res.json() : null }
}

async function getOrCreateCategory(name: string, cache: Record<string, number>): Promise<number | null> {
  if (cache[name.toLowerCase()]) return cache[name.toLowerCase()]
  const existing = await wpGet(`/categories?search=${encodeURIComponent(name)}&per_page=5`)
  if (Array.isArray(existing)) {
    const match = existing.find((c: any) => c.name.toLowerCase() === name.toLowerCase())
    if (match) { cache[name.toLowerCase()] = match.id; return match.id }
  }
  const { data } = await wpPost('/categories', { name, slug: name.toLowerCase().replace(/\s+/g, '-') })
  if (data?.id) { cache[name.toLowerCase()] = data.id; return data.id }
  return null
}

async function geminiCategorize(posts: any[], geminiKey: string) {
  const batch = posts.map(p => ({
    id: p.id,
    title: p.title?.rendered?.replace(/<[^>]+>/g, '').replace(/&#[0-9]+;/g, '').trim() || '',
    excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 150).trim() || '',
  }))

  const prompt = `You are a news editor. Categorize each article into exactly ONE category from this list:
${CATEGORIES.join(', ')}

Guidelines:
- Politics: government, elections, parliament, ministers, policy
- Business: companies, economy, RBI, markets, corporate news
- Technology: AI, gadgets, apps, software, internet, space tech
- Sports: cricket, football, IPL, Olympics, athletes
- Entertainment: movies, music, celebrities, OTT, Bollywood, TV
- Health: medical, disease, fitness, mental health, hospitals, vaccines
- Science: research, discoveries, space exploration, environment science
- Education: schools, exams, NEET, KCET, JEE, universities, students
- World: international news, wars, geopolitics, foreign countries
- India: India-specific news not fitting other categories
- Lifestyle: fashion, food, travel, relationships, culture, wellness
- Finance: stocks, mutual funds, banking, personal finance, crypto, economy
- Crime: arrests, court cases, scams, fraud, violence, police
- Environment: climate change, pollution, natural disasters, conservation
- Trending: viral content, social media trends, memes, internet culture

Articles: ${JSON.stringify(batch)}

Return ONLY valid JSON array:
[{"id":123,"category":"Technology"}]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  )
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON in response: ' + raw.slice(0, 200))
  return JSON.parse(match[0])
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'status'
  const limit  = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  // ── GET USERS ─────────────────────────────────────────────────
  if (action === 'get_author') {
    const users = await wpGet('/users?per_page=50')
    if (!Array.isArray(users)) return NextResponse.json({ error: 'Could not fetch users' })
    return NextResponse.json(users.map((u: any) => ({ id: u.id, name: u.name, slug: u.slug })))
  }

  // ── FIX AUTHOR BY CATEGORY ────────────────────────────────────
  if (action === 'fix_author_by_category') {
    const usmanId = parseInt(searchParams.get('usman_id') || '0')
    const aizalId = parseInt(searchParams.get('aizal_id') || '0')
    if (!usmanId || !aizalId) return NextResponse.json({ error: 'usman_id and aizal_id required' })

    const wpPage   = Math.floor(offset / 100) + 1
    const wpOff    = offset % 100
    const raw      = await wpGet(`/posts?per_page=100&page=${wpPage}&status=publish&_fields=id,title,categories`)
    if (!Array.isArray(raw)) return NextResponse.json({ error: 'Could not fetch posts' })
    const posts = raw.slice(wpOff, wpOff + limit)

    // Get all category names
    const allCats = await wpGet('/categories?per_page=100')
    const catMap: Record<number, string> = {}
    if (Array.isArray(allCats)) {
      for (const c of allCats) catMap[c.id] = c.name.toLowerCase()
    }

    let usman = 0, aizal = 0, failed = 0

    for (const post of posts) {
      const postCatNames = (post.categories || []).map((id: number) => catMap[id] || '').filter(Boolean)
      let authorId = usmanId // default to Usman

      // If any category matches Aizal's list → assign Aizal
      const isAizal = postCatNames.some((c: string) => AIZAL_CATEGORIES.includes(c))
      const isUsman = postCatNames.some((c: string) => USMAN_CATEGORIES.includes(c))

      if (isAizal && !isUsman) authorId = aizalId
      else if (isUsman) authorId = usmanId
      else authorId = usmanId // uncategorized → Usman

      const { ok } = await wpPost(`/posts/${post.id}`, { author: authorId })
      if (ok) { authorId === usmanId ? usman++ : aizal++ }
      else failed++
      await new Promise(r => setTimeout(r, 150))
    }

    return NextResponse.json({ usman, aizal, failed, total: posts.length })
  }

  // ── RECATEGORIZE ──────────────────────────────────────────────
  if (action === 'recategorize') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const wpPage  = Math.floor(offset / 100) + 1
    const wpOff2  = offset % 100
    const raw     = await wpGet(`/posts?per_page=100&page=${wpPage}&status=publish&_fields=id,title,excerpt&orderby=date&order=desc`)
    if (!Array.isArray(raw)) return NextResponse.json({ error: 'No posts', updated: 0 })
    const posts = raw.slice(wpOff2, wpOff2 + limit)
    if (!posts.length) return NextResponse.json({ updated: 0, total: 0 })

    const categorized = await geminiCategorize(posts, geminiKey)
    const cache: Record<string, number> = {}

    // Load existing categories
    const existingCats = await wpGet('/categories?per_page=100')
    if (Array.isArray(existingCats)) {
      for (const c of existingCats) cache[c.name.toLowerCase()] = c.id
    }

    let updated = 0, failed = 0
    for (const item of categorized) {
      const catId = await getOrCreateCategory(item.category, cache)
      if (!catId) { failed++; continue }
      const { ok } = await wpPost(`/posts/${item.id}`, { categories: [catId] })
      if (ok) updated++
      else failed++
      await new Promise(r => setTimeout(r, 150))
    }

    return NextResponse.json({
      updated, failed, total: posts.length,
      categories_used: [...new Set(categorized.map((c: any) => c.category))],
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
