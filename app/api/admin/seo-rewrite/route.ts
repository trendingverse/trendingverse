// app/api/admin/seo-rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' }

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

async function geminiRewrite(posts: any[], geminiKey: string) {
  const batch = posts.map(p => ({
    id: p.id,
    title: p.title?.rendered?.replace(/<[^>]+>/g, '') || '',
    category: p.categories?.[0] || '',
    excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 200) || '',
  }))

  const prompt = `You are a Google Discover and SEO headline expert for an Indian news site called TrendingVerse.

Analyze these ${batch.length} articles and rewrite each headline to be:
1. Google Discover friendly — curiosity-driven, emotionally engaging, 40-70 chars
2. SEO optimized — primary keyword near the start, under 60 chars for meta
3. Avoid clickbait — must be accurate to the content
4. Use power words: reveals, breaks, surges, sparks, wins, hits, faces, launches
5. No ALL CAPS. No question marks unless genuinely compelling.

Articles:
${JSON.stringify(batch, null, 2)}

Return ONLY a valid JSON array:
[
  {
    "id": <post_id>,
    "discover_headline": "Curiosity-driven Google Discover headline 40-70 chars",
    "seo_title": "SEO title under 60 chars with primary keyword",
    "meta_description": "Compelling 150-155 char meta with CTA",
    "focus_keyword": "2-4 word primary keyword",
    "seo_score_before": 45,
    "seo_score_after": 82
  }
]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      }),
    }
  )
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Could not parse Gemini response')
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
  const action = searchParams.get('action') || 'fetch' // fetch | analyze | apply | status

  // ── FETCH: Get all WP posts with current SEO data ─────────────
  if (action === 'fetch') {
    const posts = []
    let page = 1
    while (true) {
      const batch = await wpGet(`/posts?per_page=50&page=${page}&status=publish&_fields=id,title,excerpt,slug,categories,date,modified,yoast_head_json`)
      if (!Array.isArray(batch) || batch.length === 0) break
      posts.push(...batch)
      if (batch.length < 50) break
      page++
    }
    return NextResponse.json({ total: posts.length, posts: posts.map(p => ({
      id: p.id,
      title: p.title?.rendered?.replace(/<[^>]+>/g, '') || '',
      slug: p.slug,
      excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 150) || '',
      seo_title: p.yoast_head_json?.title || '',
      meta_desc: p.yoast_head_json?.description || '',
      date: p.date,
    })) })
  }

  // ── ANALYZE: Rewrite headlines with Gemini ────────────────────
  if (action === 'analyze') {
    const geminiKey = process.env.GEMINI_API_KEY!
    const limitParam = parseInt(searchParams.get('limit') || '20')

    // Get posts
    const raw = await wpGet(`/posts?per_page=${limitParam}&status=publish&_fields=id,title,excerpt,categories,yoast_head_json&orderby=date&order=desc`)
    if (!Array.isArray(raw)) return NextResponse.json({ error: 'Could not fetch posts' }, { status: 500 })

    // Rewrite in batches of 10
    const results: any[] = []
    const BATCH = 10
    for (let i = 0; i < raw.length; i += BATCH) {
      const chunk = raw.slice(i, i + BATCH)
      try {
        const rewrites = await geminiRewrite(chunk, geminiKey)
        results.push(...rewrites)
      } catch (e) {
        console.error('Batch failed:', e)
      }
      await new Promise(r => setTimeout(r, 500))
    }

    // Store suggestions in Supabase
    for (const r of results) {
      await admin.from('seo_metadata').upsert({
        post_id: r.id.toString(),
        discover_headline: r.discover_headline,
        seo_title: r.seo_title,
        meta_description: r.meta_description,
        focus_keyword: r.focus_keyword,
        score_before: r.seo_score_before,
        score_after: r.seo_score_after,
        status: 'pending',
        created_at: new Date().toISOString(),
      }, { onConflict: 'post_id' })
    }

    return NextResponse.json({ analyzed: results.length, results })
  }

  // ── APPLY: Push approved rewrites to WordPress ────────────────
  if (action === 'apply') {
    const postId    = searchParams.get('post_id')
    const applyAll  = searchParams.get('all') === 'true'

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
          _yoast_wpseo_title: item.seo_title,
          _yoast_wpseo_metadesc: item.meta_description,
          _yoast_wpseo_focuskw: item.focus_keyword,
        },
      })
      if (ok) {
        applied++
        await admin.from('seo_metadata').update({ status: 'applied' }).eq('post_id', item.post_id)
      } else failed++
      await new Promise(r => setTimeout(r, 200))
    }

    return NextResponse.json({ applied, failed })
  }

  // ── STATUS: Get all pending/approved suggestions ──────────────
  if (action === 'status') {
    const { data } = await admin.from('seo_metadata')
      .select('*').order('created_at', { ascending: false }).limit(100)
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

  const { post_id, action, discover_headline, seo_title, meta_description, focus_keyword } = await req.json()

  // Approve / reject / edit a suggestion
  if (action === 'approve') {
    await admin.from('seo_metadata').update({ status: 'approved' }).eq('post_id', post_id)
  } else if (action === 'reject') {
    await admin.from('seo_metadata').update({ status: 'rejected' }).eq('post_id', post_id)
  } else if (action === 'update') {
    await admin.from('seo_metadata').update({
      discover_headline, seo_title, meta_description, focus_keyword, status: 'approved',
    }).eq('post_id', post_id)
  } else if (action === 'apply_single') {
    const { data } = await admin.from('seo_metadata').select('*').eq('post_id', post_id).single()
    if (data) {
      const ok = await wpUpdate(parseInt(post_id), {
        title: data.discover_headline,
        meta: {
          _yoast_wpseo_title: data.seo_title,
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
