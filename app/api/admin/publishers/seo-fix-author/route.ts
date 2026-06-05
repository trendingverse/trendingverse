// app/api/admin/seo-fix-author/route.ts
// Fixes author name + recategorizes all posts using AI
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' }

// Google-friendly category taxonomy for news sites
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
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null }
}

async function getOrCreateCategory(name: string, categoryCache: Record<string, number>): Promise<number | null> {
  if (categoryCache[name.toLowerCase()]) return categoryCache[name.toLowerCase()]

  // Search existing
  const existing = await wpGet(`/categories?search=${encodeURIComponent(name)}&per_page=5`)
  if (Array.isArray(existing)) {
    const match = existing.find((c: any) => c.name.toLowerCase() === name.toLowerCase())
    if (match) { categoryCache[name.toLowerCase()] = match.id; return match.id }
  }

  // Create new
  const { data } = await wpPost('/categories', { name, slug: name.toLowerCase().replace(/\s+/g, '-') })
  if (data?.id) { categoryCache[name.toLowerCase()] = data.id; return data.id }
  return null
}

async function geminiCategorize(posts: any[], geminiKey: string) {
  const batch = posts.map(p => ({
    id: p.id,
    title: p.title?.rendered?.replace(/<[^>]+>/g, '').replace(/&#[0-9]+;/g, '').trim() || '',
    excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 150).trim() || '',
  }))

  const prompt = `You are a news editor at a major Indian news site. Categorize each article into exactly ONE of these Google News approved categories:
${CATEGORIES.join(', ')}

Rules:
- Politics: government, elections, politicians, policy, parliament
- Business: companies, economy, markets, trade, RBI, corporate
- Technology: AI, gadgets, apps, software, internet, space, science discoveries
- Sports: cricket, football, IPL, Olympics, athletes
- Entertainment: movies, music, celebrities, OTT, Bollywood
- Health: medical, disease, fitness, mental health, hospitals
- Science: research, discoveries, space, environment
- Education: schools, exams, NEET, KCET, universities
- World: international news, wars, geopolitics, foreign countries
- India: India-specific news that doesn't fit other categories
- Lifestyle: fashion, food, travel, relationships, culture
- Finance: stocks, mutual funds, banking, personal finance, crypto
- Crime: arrests, court cases, scams, violence
- Environment: climate, pollution, natural disasters
- Trending: viral, social media, internet culture

Articles:
${JSON.stringify(batch)}

Return ONLY a valid JSON array:
[{"id": 123, "category": "Technology", "subcategory": "Artificial Intelligence"}]`

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
  if (!match) throw new Error('No JSON in response')
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

  // ── GET AUTHOR ID ─────────────────────────────────────────────
  if (action === 'get_author') {
    const users = await wpGet('/users?per_page=50')
    if (!Array.isArray(users)) return NextResponse.json({ error: 'Could not fetch users' })
    return NextResponse.json(users.map((u: any) => ({ id: u.id, name: u.name, slug: u.slug, email: u.email })))
  }

  // ── FIX AUTHOR: Tag all posts as Usman ───────────────────────
  if (action === 'fix_author') {
    const authorId = parseInt(searchParams.get('author_id') || '0')
    if (!authorId) return NextResponse.json({ error: 'author_id required' })

    const wpPage = Math.floor(offset / 100) + 1
    const wpOffset = offset % 100
    const raw = await wpGet(`/posts?per_page=100&page=${wpPage}&status=publish&_fields=id,title,author`)
    if (!Array.isArray(raw)) return NextResponse.json({ error: 'Could not fetch posts' })

    const posts = raw.slice(wpOffset, wpOffset + limit)
    let updated = 0, skipped = 0, failed = 0

    for (const post of posts) {
      if (post.author === authorId) { skipped++; continue }
      const { ok } = await wpPost(`/posts/${post.id}`, { author: authorId })
      if (ok) updated++
      else failed++
      await new Promise(r => setTimeout(r, 150))
    }

    return NextResponse.json({ updated, skipped, failed, total: posts.length })
  }

  // ── RECATEGORIZE: AI-powered category assignment ──────────────
  if (action === 'recategorize') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const wpPage  = Math.floor(offset / 100) + 1
    const wpOffset2 = offset % 100
    const raw = await wpGet(`/posts?per_page=100&page=${wpPage}&status=publish&_fields=id,title,excerpt,categories&orderby=date&order=desc`)
    if (!Array.isArray(raw)) return NextResponse.json({ error: 'Could not fetch posts' })

    const posts = raw.slice(wpOffset2, wpOffset2 + limit)
    if (!posts.length) return NextResponse.json({ error: 'No posts at this offset', updated: 0 })

    // Get AI categorization
    const categorized = await geminiCategorize(posts, geminiKey)

    // Cache category IDs
    const categoryCache: Record<string, number> = {}

    // Load existing WP categories
    const existingCats = await wpGet('/categories?per_page=100')
    if (Array.isArray(existingCats)) {
      for (const c of existingCats) categoryCache[c.name.toLowerCase()] = c.id
    }

    let updated = 0, failed = 0
    for (const item of categorized) {
      const catId = await getOrCreateCategory(item.category, categoryCache)
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
