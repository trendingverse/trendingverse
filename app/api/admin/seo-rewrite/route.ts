// app/api/admin/seo-rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' }

const VALID_CATEGORIES = [
  'Politics', 'Business', 'Technology', 'Entertainment', 'Sports',
  'Health', 'Science', 'Lifestyle', 'Education', 'World',
  'Crime', 'India', 'Environment', 'Finance', 'Trending'
]

async function wpGet(path: string) {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2${path}`, { headers: WP_HEADERS })
  if (!res.ok) return null
  return res.json()
}

async function wpUpdate(postId: number, data: object) {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/${postId}`, {
    method: 'POST', headers: WP_HEADERS, body: JSON.stringify(data),
  })
  return res.ok
}

async function getOrCreateWpTag(tagName: string): Promise<number | null> {
  try {
    const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const searchRes = await fetch(`${WP_BASE}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}&per_page=5`, { headers: WP_HEADERS })
    if (searchRes.ok) {
      const tags = await searchRes.json()
      const existing = tags.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase() || t.slug === slug)
      if (existing) return existing.id
    }
    const createRes = await fetch(`${WP_BASE}/wp-json/wp/v2/tags`, {
      method: 'POST', headers: WP_HEADERS,
      body: JSON.stringify({ name: tagName, slug }),
    })
    if (createRes.ok) {
      const tag = await createRes.json()
      return tag.id || null
    }
  } catch { /* skip */ }
  return null
}

async function getOrCreateWpCategory(catName: string): Promise<number | null> {
  try {
    const searchRes = await fetch(`${WP_BASE}/wp-json/wp/v2/categories?search=${encodeURIComponent(catName)}&per_page=10`, { headers: WP_HEADERS })
    if (searchRes.ok) {
      const cats = await searchRes.json()
      const existing = cats.find((c: any) => c.name.toLowerCase() === catName.toLowerCase())
      if (existing) return existing.id
    }
    const createRes = await fetch(`${WP_BASE}/wp-json/wp/v2/categories`, {
      method: 'POST', headers: WP_HEADERS,
      body: JSON.stringify({ name: catName, slug: catName.toLowerCase() }),
    })
    if (createRes.ok) {
      const cat = await createRes.json()
      return cat.id || null
    }
  } catch { /* skip */ }
  return null
}

async function geminiRewrite(posts: any[], geminiKey: string) {
  const batch = posts.map(p => ({
    id: p.id,
    title: p.title?.rendered?.replace(/<[^>]+>/g, '').replace(/&#[0-9]+;/g, '').trim() || '',
    excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 200).trim() || '',
  })).filter(p => p.title.length > 5)

  if (!batch.length) return []

  const prompt = `You are a Google Discover and SEO headline expert for TrendingVerse — an Indian news site.

Rewrite headlines for these ${batch.length} articles to maximise Google Discover clicks and organic search rankings.

Rules:
- discover_headline: 45-70 chars, curiosity-driven, emotionally engaging, accurate to the content
- seo_title: under 60 chars, primary keyword near the start
- meta_description: exactly 150-155 chars, include a call to action
- focus_keyword: 2-4 words, what someone would Google to find this article
- keywords: array of 5-8 relevant tags/keywords for this article
- category: one of: ${VALID_CATEGORIES.join(', ')}
- seo_score_before: estimate current SEO quality 0-100
- seo_score_after: your improved score 0-100
- Never use ALL CAPS. No emoji in headlines. Be accurate — no clickbait.

Articles:
${JSON.stringify(batch)}

Return ONLY a valid JSON array:
[{"id":1,"discover_headline":"...","seo_title":"...","meta_description":"...","focus_keyword":"...","keywords":["tag1","tag2"],"category":"Politics","seo_score_before":40,"seo_score_after":78}]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    }
  )
  const data = await res.json()
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in Gemini response: ' + raw.slice(0, 200))
  return JSON.parse(match[0])
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'fetch'

  // ── FETCH ────────────────────────────────────────────────────
  if (action === 'fetch') {
    const posts: any[] = []
    let page = 1
    while (true) {
      const batch = await wpGet(`/posts?per_page=50&page=${page}&status=publish&_fields=id,title,excerpt,slug,date`)
      if (!Array.isArray(batch) || batch.length === 0) break
      posts.push(...batch)
      if (batch.length < 50) break
      page++
    }
    return NextResponse.json({
      total: posts.length,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title?.rendered?.replace(/<[^>]+>/g, '') || '',
        slug: p.slug,
        excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 150) || '',
        date: p.date,
      }))
    })
  }

  // ── ANALYZE ──────────────────────────────────────────────────
  if (action === 'analyze') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const wpPage = Math.floor(offset / 100) + 1
    const wpOffset = offset % 100
    const raw = await wpGet(`/posts?per_page=100&page=${wpPage}&status=publish&_fields=id,title,excerpt&orderby=date&order=desc`)
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No posts fetched from WordPress', analyzed: 0 })
    }
    const posts = raw.slice(wpOffset, wpOffset + limit)
    if (!posts.length) {
      return NextResponse.json({ error: 'No posts in range', analyzed: 0 })
    }

    const allResults: any[] = []
    const BATCH_SIZE = 10
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const chunk = posts.slice(i, i + BATCH_SIZE)
      try {
        const rewrites = await geminiRewrite(chunk, geminiKey)
        if (!rewrites.length) return NextResponse.json({ error: 'Gemini returned empty array', analyzed: 0 })
        allResults.push(...rewrites)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message, analyzed: 0 })
      }
      if (i + BATCH_SIZE < posts.length) await new Promise(r => setTimeout(r, 1000))
    }

    let saved = 0
    for (const r of allResults) {
      const { data: existing } = await admin.from('seo_metadata').select('article_id').eq('post_id', r.id.toString()).single()
      if (existing) {
        const { error } = await admin.from('seo_metadata').update({
          discover_headline: r.discover_headline || '',
          seo_title: r.seo_title || '',
          meta_description: r.meta_description || '',
          focus_keyword: r.focus_keyword || '',
          score_before: r.seo_score_before || 0,
          score_after: r.seo_score_after || 0,
          status: 'pending',
          updated_at: new Date().toISOString(),
        }).eq('post_id', r.id.toString())
        if (!error) saved++
      } else {
        const { error } = await admin.from('seo_metadata').insert({
          post_id: r.id.toString(),
          discover_headline: r.discover_headline || '',
          seo_title: r.seo_title || '',
          meta_description: r.meta_description || '',
          focus_keyword: r.focus_keyword || '',
          score_before: r.seo_score_before || 0,
          score_after: r.seo_score_after || 0,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        if (!error) saved++
      }
    }
    return NextResponse.json({ analyzed: allResults.length, saved, results: allResults })
  }

  // ── BULK FIX — categorize + tag + SEO rewrite all articles ───
  if (action === 'bulk_fix') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch WP posts with content for categorization
    const wpPage = Math.floor(offset / 50) + 1
    const wpOffset = offset % 50
    const raw = await wpGet(`/posts?per_page=50&page=${wpPage}&status=publish&_fields=id,title,excerpt,categories,tags&orderby=date&order=desc`)
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No posts found', fixed: 0 })
    }
    const posts = raw.slice(wpOffset, wpOffset + limit)

    // Fetch existing WP categories
    const wpCatsRaw = await wpGet('/categories?per_page=100')
    const wpCategoryMap: Record<string, number> = {}
    for (const c of wpCatsRaw || []) {
      wpCategoryMap[c.name.toLowerCase()] = c.id
    }

    // Run AI analysis — get category + keywords + SEO for each post
    const allResults: any[] = []
    const BATCH_SIZE = 10
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
      const chunk = posts.slice(i, i + BATCH_SIZE)
      try {
        const rewrites = await geminiRewrite(chunk, geminiKey)
        allResults.push(...rewrites)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message, fixed: 0 })
      }
      if (i + BATCH_SIZE < posts.length) await new Promise(r => setTimeout(r, 1000))
    }

    // Apply each result to WordPress
    let fixed = 0, failed = 0
    const results = []

    for (const r of allResults) {
      try {
        // Get or create category in WP
        const catName = VALID_CATEGORIES.includes(r.category) ? r.category : 'News'
        let catId = wpCategoryMap[catName.toLowerCase()]
        if (!catId) {
          const newCatId = await getOrCreateWpCategory(catName)
          if (newCatId) { catId = newCatId; wpCategoryMap[catName.toLowerCase()] = newCatId }
        }

        // Get or create tags in WP
        const tagNames: string[] = [
          ...(Array.isArray(r.keywords) ? r.keywords : []),
          r.focus_keyword,
          catName,
        ].filter(Boolean).slice(0, 10)

        const tagIdPromises = tagNames.map((t: string) => getOrCreateWpTag(t))
        const tagIds = (await Promise.all(tagIdPromises)).filter((id): id is number => id !== null)

        // Update WP post — category + tags + SEO
        const ok = await wpUpdate(r.id, {
          title: r.discover_headline || undefined,
          categories: catId ? [catId] : undefined,
          tags: tagIds,
          meta: {
            _yoast_wpseo_title: r.seo_title + ' - TrendingVerse',
            _yoast_wpseo_metadesc: r.meta_description,
            _yoast_wpseo_focuskw: r.focus_keyword,
          },
        })

        // Also update seo_metadata in Supabase
        await admin.from('seo_metadata').upsert({
          post_id: r.id.toString(),
          discover_headline: r.discover_headline || '',
          seo_title: r.seo_title || '',
          meta_description: r.meta_description || '',
          focus_keyword: r.focus_keyword || '',
          score_before: r.seo_score_before || 0,
          score_after: r.seo_score_after || 0,
          status: 'applied',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'post_id' })

        // Update articles table category
        await admin.from('articles').update({
          category_name: catName,
          keywords: Array.isArray(r.keywords) ? r.keywords : [],
          focus_keyword: r.focus_keyword || '',
          seo_title: r.seo_title || '',
          meta_description: r.meta_description || '',
        }).eq('seo_title', r.seo_title || '').limit(1)

        if (ok) { fixed++; results.push({ id: r.id, category: catName, tags: tagNames.length, ok: true }) }
        else { failed++; results.push({ id: r.id, ok: false }) }

        await new Promise(resolve => setTimeout(resolve, 400)) // rate limit
      } catch (e) {
        failed++
        results.push({ id: r.id, ok: false, error: (e as Error).message })
      }
    }

    return NextResponse.json({ fixed, failed, total: allResults.length, results })
  }

  // ── APPLY ALL APPROVED ───────────────────────────────────────
  if (action === 'apply') {
    const applyAll = searchParams.get('all') === 'true'
    const postId   = searchParams.get('post_id')
    let toApply: any[] = []
    if (applyAll) {
      const { data } = await admin.from('seo_metadata').select('*').eq('status', 'approved')
      toApply = data || []
    } else if (postId) {
      const { data } = await admin.from('seo_metadata').select('*').eq('post_id', postId)
      toApply = data || []
    }
    let applied = 0, failed = 0
    for (const item of toApply) {
      const ok = await wpUpdate(parseInt(item.post_id), {
        title: item.discover_headline,
        meta: {
          _yoast_wpseo_title: item.seo_title + ' - TrendingVerse',
          _yoast_wpseo_metadesc: item.meta_description,
          _yoast_wpseo_focuskw: item.focus_keyword,
        },
      })
      if (ok) { applied++; await admin.from('seo_metadata').update({ status: 'applied' }).eq('post_id', item.post_id) }
      else failed++
      await new Promise(r => setTimeout(r, 300))
    }
    return NextResponse.json({ applied, failed })
  }

  // ── STATUS ───────────────────────────────────────────────────
  if (action === 'status') {
    const { data } = await admin.from('seo_metadata')
      .select('*').order('updated_at', { ascending: false }).limit(200)
      .not('post_id', 'is', null)
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  const { post_id, action, discover_headline, seo_title, meta_description, focus_keyword } = body

  if (action === 'approve') {
    await admin.from('seo_metadata').update({ status: 'approved' }).eq('post_id', post_id)
  } else if (action === 'reject') {
    await admin.from('seo_metadata').update({ status: 'rejected' }).eq('post_id', post_id)
  } else if (action === 'update') {
    await admin.from('seo_metadata').update({
      discover_headline, seo_title, meta_description, focus_keyword, status: 'approved',
      updated_at: new Date().toISOString(),
    }).eq('post_id', post_id)
  } else if (action === 'apply_single') {
    const { data } = await admin.from('seo_metadata').select('*').eq('post_id', post_id).single()
    if (data) {
      const ok = await wpUpdate(parseInt(post_id), {
        title: data.discover_headline,
        meta: {
          _yoast_wpseo_title: data.seo_title + ' - TrendingVerse',
          _yoast_wpseo_metadesc: data.meta_description,
          _yoast_wpseo_focuskw: data.focus_keyword,
        },
      })
      if (ok) await admin.from('seo_metadata').update({ status: 'applied' }).eq('post_id', post_id)
      return NextResponse.json({ success: ok })
    }
  }

  return NextResponse.json({ success: true })
}
