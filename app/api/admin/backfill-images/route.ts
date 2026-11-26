export const runtime = 'edge'
// app/api/admin/backfill-images/route.ts
// One-shot route to fetch Pexels images for articles missing cover_image_url.
// Called by admin only. Processes up to `limit` articles per request.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

async function fetchPexelsImage(query: string, pexelsKey: string): Promise<string | null> {
  // Strip non-ASCII (Indian language titles) — Pexels needs Latin keywords
  const clean = query.replace(/[^\x00-\x7F]/g, ' ').trim()
  const keywords = clean.split(' ').filter(w => w.length > 3).slice(0, 4).join(' ') || 'india news'
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=3&orientation=landscape&size=large`,
      { headers: { Authorization: pexelsKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data.photos?.[0]
    return photo ? (photo.src.large2x || photo.src.large || photo.src.original) : null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const pexelsKey = process.env.PEXELS_API_KEY || 'Hg3cYZqEt9VuKvMh0eP8UBbrzYXUSpLrUMitD9ecBVDLyuwaXyRR3K0Z'
  if (!pexelsKey) return NextResponse.json({ error: 'PEXELS_API_KEY not configured' }, { status: 500 })

  const { limit = 20, article_id } = await req.json().catch(() => ({}))

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '')!
  )

  // Single article mode
  if (article_id) {
    const { data: article } = await admin.from('articles').select('id,title,category_name').eq('id', article_id).single()
    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    const query = `${article.title} ${article.category_name || ''}`.trim()
    const imageUrl = await fetchPexelsImage(query, pexelsKey)
    if (!imageUrl) return NextResponse.json({ error: 'No Pexels image found for: ' + query }, { status: 404 })
    await admin.from('articles').update({ cover_image_url: imageUrl, og_image_url: imageUrl }).eq('id', article_id)
    return NextResponse.json({ updated: 1, image_url: imageUrl })
  }

  // Bulk mode — articles missing cover image, most recent first
  const { data: articles } = await admin
    .from('articles')
    .select('id,title,category_name')
    .is('cover_image_url', null)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!articles?.length) return NextResponse.json({ updated: 0, message: 'No articles missing images' })

  const results: { id: string; title: string; image_url: string | null; ok: boolean }[] = []

  for (const article of articles) {
    const query = `${article.title} ${article.category_name || ''}`.trim()
    const imageUrl = await fetchPexelsImage(query, pexelsKey)
    if (imageUrl) {
      await admin.from('articles').update({ cover_image_url: imageUrl, og_image_url: imageUrl }).eq('id', article.id)
      results.push({ id: article.id, title: article.title, image_url: imageUrl, ok: true })
    } else {
      results.push({ id: article.id, title: article.title, image_url: null, ok: false })
    }
    // Rate-limit: Pexels free plan allows 200 req/hour
    await new Promise(r => setTimeout(r, 300))
  }

  const updated = results.filter(r => r.ok).length
  return NextResponse.json({ updated, total: articles.length, results })
}
