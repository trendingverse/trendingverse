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

  // ── RECATEGORIZE ONLY — verify + correct category per article ───
// Unlike bulk_fix, this NEVER touches title, tags, or SEO metadata.
// It only checks whether the current category is appropriate for the
// content, and corrects it if not.
async function geminiCategoryCheck(posts: any[], geminiKey: string) {
  const batch = posts.map(p => ({
    id: p.id,
    title: p.title?.rendered?.replace(/<[^>]+>/g, '').replace(/&#[0-9]+;/g, '').trim() || '',
    excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 200).trim() || '',
    current_category: p.current_category || 'Uncategorized',
  })).filter(p => p.title.length > 5)

  if (!batch.length) return []

  const prompt = `You are auditing news article categorization for TrendingVerse, an Indian news site.

For each article below, you are given its title, excerpt, and CURRENTLY ASSIGNED category.
Determine the single best-fit category from EXACTLY this list (use this exact spelling/casing):
${VALID_CATEGORIES.join(', ')}

Be conservative — only flag needs_change as true if the current category is clearly wrong for the content. Minor stylistic disagreement (e.g. "Business" vs "Finance" for a markets story) should NOT be flagged unless one is clearly incorrect.

IMPORTANT: keep "reason" to 5 words maximum — this keeps the output compact.

Articles:
${JSON.stringify(batch)}

Return ONLY a valid JSON array, no markdown, no commentary before or after:
[{"id":1,"current_category":"Politics","correct_category":"World","needs_change":true,"reason":"max 5 words"}]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    }
  )
  const data = await res.json()
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const finishReason = data.candidates?.[0]?.finishReason || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) {
    const truncatedNote = finishReason === 'MAX_TOKENS' ? ' [TRUNCATED — hit token limit, try a smaller batch]' : ''
    throw new Error(`No JSON array in Gemini response${truncatedNote}. finishReason=${finishReason}, length=${raw.length}. Tail: ${raw.slice(-200)}`)
  }
  return JSON.parse(match[0])
}

// ── BULK FIX — categorize + tag + SEO rewrite all articles ───
  if (action === 'bulk_fix') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const wpPage = Math.floor(offset / 50) + 1
    const wpOffset = offset % 50
    const raw = await wpGet(`/posts?per_page=50&page=${wpPage}&status=publish&_fields=id,title,excerpt,categories,tags&orderby=date&order=desc`)
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No posts found', fixed: 0 })
    }
    const posts = raw.slice(wpOffset, wpOffset + limit)

    const wpCatsRaw = await wpGet('/categories?per_page=100')
    const wpCategoryMap: Record<string, number> = {}
    for (const c of wpCatsRaw || []) {
      wpCategoryMap[c.name.toLowerCase()] = c.id
    }

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

    let fixed = 0, failed = 0
    const results = []

    for (const r of allResults) {
      try {
        const catName = VALID_CATEGORIES.includes(r.category) ? r.category : 'News'
        let catId = wpCategoryMap[catName.toLowerCase()]
        if (!catId) {
          const newCatId = await getOrCreateWpCategory(catName)
          if (newCatId) { catId = newCatId; wpCategoryMap[catName.toLowerCase()] = newCatId }
        }

        const tagNames: string[] = [
          ...(Array.isArray(r.keywords) ? r.keywords : []),
          r.focus_keyword,
          catName,
        ].filter(Boolean).slice(0, 10)

        const tagIdPromises = tagNames.map((t: string) => getOrCreateWpTag(t))
        const tagIds = (await Promise.all(tagIdPromises)).filter((id): id is number => id !== null)

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

        // Update articles table — match by wp_post_id (reliable) instead of
        // the old seo_title match, which compared against the NEW seo_title
        // before it was saved and therefore almost never matched anything.
        await admin.from('articles').update({
          category_name: catName,
          keywords: Array.isArray(r.keywords) ? r.keywords : [],
          focus_keyword: r.focus_keyword || '',
          seo_title: r.seo_title || '',
          meta_description: r.meta_description || '',
        }).eq('wp_post_id', r.id)

        if (ok) { fixed++; results.push({ id: r.id, category: catName, tags: tagNames.length, ok: true }) }
        else { failed++; results.push({ id: r.id, ok: false }) }

        await new Promise(resolve => setTimeout(resolve, 400))
      } catch (e) {
        failed++
        results.push({ id: r.id, ok: false, error: (e as Error).message })
      }
    }

    return NextResponse.json({ fixed, failed, total: allResults.length, results })
  }

  // ── RECATEGORIZE — category-only audit & correction ──────────
  if (action === 'recategorize') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const dryRun = searchParams.get('dry_run') === 'true'

    const wpPage = Math.floor(offset / 50) + 1
    const wpOffset = offset % 50
    const raw = await wpGet(`/posts?per_page=50&page=${wpPage}&status=publish&_fields=id,title,excerpt,categories,slug&orderby=date&order=desc`)
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No posts found', checked: 0 })
    }
    const posts = raw.slice(wpOffset, wpOffset + limit)
    if (!posts.length) return NextResponse.json({ error: 'No posts in range', checked: 0 })

    const wpCatsRaw = await wpGet('/categories?per_page=100')
    const catIdToName: Record<number, string> = {}
    const catNameToId: Record<string, number> = {}
    for (const c of wpCatsRaw || []) {
      catIdToName[c.id] = c.name
      catNameToId[c.name.toLowerCase()] = c.id
    }

    const postsWithCurrentCat = posts.map((p: any) => ({
      ...p,
      current_category: (p.categories || []).map((id: number) => catIdToName[id]).filter(Boolean)[0] || 'Uncategorized',
    }))

    const allResults: any[] = []
    const BATCH_SIZE = 8
    for (let i = 0; i < postsWithCurrentCat.length; i += BATCH_SIZE) {
      const chunk = postsWithCurrentCat.slice(i, i + BATCH_SIZE)
      try {
        const checks = await geminiCategoryCheck(chunk, geminiKey)
        allResults.push(...checks)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message, checked: 0, partial_results: allResults })
      }
      if (i + BATCH_SIZE < postsWithCurrentCat.length) await new Promise(r => setTimeout(r, 1000))
    }

    let changed = 0, unchanged = 0, failed = 0
    const changes: any[] = []

    for (const r of allResults) {
      if (!r.needs_change) { unchanged++; continue }
      const correctCat = VALID_CATEGORIES.find(c => c.toLowerCase() === (r.correct_category || '').toLowerCase())
      if (!correctCat) { unchanged++; continue }

      // Build the change record first, but DON'T assume success yet —
      // `applied` and `error` get filled in below based on the actual outcome.
      const changeRecord: any = {
        id: r.id,
        from: r.current_category,
        to: correctCat,
        reason: r.reason || '',
        applied: false,
      }
      changes.push(changeRecord)

      if (dryRun) { changeRecord.applied = false; changeRecord.note = 'dry run — not applied'; continue }

      try {
        let catId = catNameToId[correctCat.toLowerCase()]
        if (!catId) {
          const newCatId = await getOrCreateWpCategory(correctCat)
          if (newCatId) { catId = newCatId; catNameToId[correctCat.toLowerCase()] = newCatId }
        }
        if (!catId) {
          failed++
          changeRecord.applied = false
          changeRecord.error = 'Could not resolve category ID'
          await new Promise(resolve => setTimeout(resolve, 300))
          continue
        }

        // Only update categories — title, tags, SEO metadata untouched
        const ok = await wpUpdate(r.id, { categories: [catId] })

        if (ok) {
          await admin.from('articles').update({ category_name: correctCat }).eq('wp_post_id', r.id)
          changed++
          changeRecord.applied = true
        } else {
          failed++
          changeRecord.applied = false
          changeRecord.error = 'WordPress update failed'
        }
      } catch (e) {
        failed++
        changeRecord.applied = false
        changeRecord.error = (e as Error).message
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    return NextResponse.json({
      checked: allResults.length,
      changed,
      unchanged,
      failed,
      dry_run: dryRun,
      changes,
    })
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
