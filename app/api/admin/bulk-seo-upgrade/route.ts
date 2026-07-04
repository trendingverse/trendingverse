// app/api/admin/bulk-seo-upgrade/route.ts
// Upgrades low-scoring articles by adding the structural SEO elements they're
// missing — mostly deterministic (zero AI cost): image w/ alt text, internal
// link, excerpt. One small AI call per article ONLY for H2 subheadings.
// Then re-scores, updates the DB, and re-pushes to WordPress.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeSeoScore } from '@/lib/seo-scorer'

export const maxDuration = 300

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')

// ── DETERMINISTIC FIX 1 — ensure an image with keyword alt text ──
function ensureImage(content: string, focusKeyword: string, category: string): string {
  if (/<img[^>]+alt=["'][^"']+["'][^>]*>/i.test(content)) return content // already has img+alt
  const alt = `${focusKeyword || category || 'news'} - TrendingVerse`
  const figure = `<figure><img src="https://trendingverse.online/wp-content/uploads/tv-placeholder.jpg" alt="${alt}" width="1200" height="675" /></figure>\n`
  return figure + content
}

// ── DETERMINISTIC FIX 2 — ensure at least one internal link ──────
function ensureLink(content: string): string {
  if (/<a[^>]+href/i.test(content)) return content // already has a link
  // Add a contextual link to the first paragraph's end
  const firstPClose = content.indexOf('</p>')
  if (firstPClose === -1) {
    return content + `\n<p>Read more news and analysis at <a href="https://trendingverse.online" target="_blank">TrendingVerse</a>.</p>`
  }
  const linkSentence = ` For more updates, visit <a href="https://trendingverse.online" target="_blank">TrendingVerse</a>.`
  return content.slice(0, firstPClose) + linkSentence + content.slice(firstPClose)
}

// ── DETERMINISTIC FIX 3 — ensure excerpt ─────────────────────────
function ensureExcerpt(excerpt: string, content: string, focusKeyword: string): string {
  if (excerpt && excerpt.replace(/<[^>]+>/g, '').trim().length >= 80) return excerpt
  const plain = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const firstSentence = plain.split(/[.!?]/)[0]?.trim() || plain.slice(0, 120)
  let ex = firstSentence.slice(0, 150)
  if (focusKeyword && !ex.toLowerCase().includes(focusKeyword.toLowerCase())) {
    ex = `${focusKeyword}: ${ex}`.slice(0, 150)
  }
  return ex
}

// ── AI FIX — generate H2 subheadings + insertion points (cheap) ──
async function generateH2s(content: string, title: string, focusKeyword: string, geminiKey: string): Promise<string> {
  // Only run if content has fewer than 2 H2s
  const existingH2s = (content.match(/<h2/gi) || []).length
  if (existingH2s >= 2) return content

  const paragraphs = content.split('</p>').filter(p => p.includes('<p'))
  if (paragraphs.length < 3) return content // too short to section meaningfully

  const plainForAI = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate 3 short H2 subheadings for this article. Each should describe a section of the content. Include the keyword "${focusKeyword}" in at least one. Keep each under 8 words.

Title: ${title}
Content: ${plainForAI}

Return ONLY JSON: {"subheadings":["...","...","..."]}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
        }),
      }
    )
    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = raw.replace(/```json\n?|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!match) return content
    const { subheadings } = JSON.parse(match[0])
    if (!Array.isArray(subheadings) || !subheadings.length) return content

    // Insert H2s at roughly even intervals among paragraphs
    const parts = content.split('</p>')
    const withClosers = parts.map((p, i) => i < parts.length - 1 ? p + '</p>' : p)
    const interval = Math.floor(withClosers.length / (subheadings.length + 1))
    let result = ''
    let shIdx = 0
    for (let i = 0; i < withClosers.length; i++) {
      // Insert an H2 before this paragraph at each interval (skip the very first)
      if (shIdx < subheadings.length && i > 0 && i % interval === 0) {
        result += `\n<h2>${subheadings[shIdx]}</h2>\n`
        shIdx++
      }
      result += withClosers[i]
    }
    return result
  } catch {
    return content
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const geminiKey = process.env.GEMINI_API_KEY!

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '15')  // small batches to avoid timeout
  const offset = parseInt(searchParams.get('offset') || '0')
  const dryRun = searchParams.get('dry_run') === 'true'
  const pushToWp = searchParams.get('push_wp') !== 'false' // default true
  const useAiH2 = searchParams.get('ai_h2') !== 'false'    // default true

  // Only articles scoring under 50
  const { data: articles } = await admin
    .from('articles')
    .select('id, title, seo_title, content, excerpt, meta_description, focus_keyword, category_name, seo_score, wp_post_id')
    .lt('seo_score', 50)
    .order('seo_score', { ascending: true })
    .range(offset, offset + limit - 1)

  if (!articles?.length) {
    return NextResponse.json({ message: 'No articles under 50 in this range', fixed: 0, offset })
  }

  const results: any[] = []

  for (const a of articles) {
    let content = a.content || ''
    const fk = a.focus_keyword || ''

    // Apply deterministic fixes (free)
    content = ensureImage(content, fk, a.category_name || '')
    content = ensureLink(content)
    const excerpt = ensureExcerpt(a.excerpt || '', content, fk)

    // Apply AI H2 fix (cheap, optional)
    if (useAiH2) {
      content = await generateH2s(content, a.title || '', fk, geminiKey)
    }

    // Re-score
    const scoreResult = computeSeoScore({
      title: a.seo_title || a.title || '',
      content,
      metaDescription: a.meta_description || '',
      focusKeyword: fk,
      excerpt,
    })

    const entry: any = {
      id: a.id,
      title: (a.title || '').slice(0, 45),
      old_score: a.seo_score,
      new_score: scoreResult.total,
      grade: scoreResult.grade,
      wp_updated: false,
    }

    if (!dryRun) {
      // Update DB
      await admin.from('articles').update({
        content,
        excerpt,
        seo_score: scoreResult.total,
        updated_at: new Date().toISOString(),
      }).eq('id', a.id)

      // Push to WordPress if it's a live post
      if (pushToWp && a.wp_post_id) {
        try {
          const wpRes = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/${a.wp_post_id}`, {
            method: 'POST',
            headers: { Authorization: `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, excerpt }),
          })
          entry.wp_updated = wpRes.ok
        } catch { entry.wp_updated = false }
      }
    }

    results.push(entry)
    await new Promise(r => setTimeout(r, 250))
  }

  const avgOld = Math.round(results.reduce((s, r) => s + r.old_score, 0) / results.length)
  const avgNew = Math.round(results.reduce((s, r) => s + r.new_score, 0) / results.length)

  return NextResponse.json({
    dry_run: dryRun,
    processed: results.length,
    offset,
    next_offset: offset + limit,
    avg_score_before: avgOld,
    avg_score_after: avgNew,
    wp_pushed: results.filter(r => r.wp_updated).length,
    results,
  })
}
