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
- seo_score_before: estimate current SEO quality 0-100
- seo_score_after: your improved score 0-100
- Never use ALL CAPS. No emoji in headlines. Be accurate — no clickbait.
- Use power words: reveals, breaks, surges, sparks, wins, hits, faces, launches, exposes, confirms

Articles:
${JSON.stringify(batch)}

Return ONLY a valid JSON array — no markdown, no explanation:
[{"id":1,"discover_headline":"...","seo_title":"...","meta_description":"...","focus_keyword":"...","seo_score_before":40,"seo_score_after":78}]`

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

    const raw = await wpGet(`/posts?per_page=${limit}&status=publish&_fields=id,title,excerpt&orderby=date&order=desc`)
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'No posts fetched from WordPress', analyzed: 0 })
    }

    const allResults: any[] = []
    const BATCH_SIZE = 10

    for (let i = 0; i < raw.length; i += BATCH_SIZE) {
      const chunk = raw.slice(i, i + BATCH_SIZE)
try {
        const rewrites = await geminiRewrite(chunk, geminiKey)
        allResults.push(...rewrites)
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message, analyzed: 0 })
      }
      if (i + BATCH_SIZE < raw.length) await new Promise(r => setTimeout(r, 1000))
    }

    if (!allResults.length) {
      return NextResponse.json({ error: 'Gemini returned no results', analyzed: 0 })
    }

    // Save to Supabase
    // Save to Supabase
    let saved = 0
    for (const r of allResults) {
      // Try update first, then insert
      const { data: existing } = await admin
        .from('seo_metadata').select('article_id').eq('post_id', r.id.toString()).single()

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
        const { error, data } = await admin.from('seo_metadata').insert({
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
        else return NextResponse.json({ insert_error: error, sample_record: { post_id: r.id.toString() } })
      }
    }

    return NextResponse.json({ analyzed: allResults.length, saved, results: allResults })
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
      if (ok) {
        applied++
        await admin.from('seo_metadata').update({ status: 'applied' }).eq('post_id', item.post_id)
      } else {
        failed++
      }
      await new Promise(r => setTimeout(r, 300))
    }
    return NextResponse.json({ applied, failed })
  }

  // ── STATUS ───────────────────────────────────────────────────
  if (action === 'status') {
    const { data } = await admin.from('seo_metadata')
      .select('*').order('created_at', { ascending: false }).limit(200)
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
