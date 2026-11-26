export const runtime = 'edge'
// app/api/admin/backfill-wp-images/route.ts
// Sets featured images on WordPress posts for articles that have a cover_image_url
// but whose WP post is missing a featured image. Admin-only.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

async function uploadImageToWP(
  base: string,
  auth: string,
  imageUrl: string,
  title: string
): Promise<number | null> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!imgRes.ok) return null
    const buffer = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.${ext}`

    const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': contentType,
      },
      body: buffer,
    })
    if (!uploadRes.ok) return null
    const data = await uploadRes.json()
    return data?.id || null
  } catch {
    return null
  }
}

async function setFeaturedImage(
  base: string,
  auth: string,
  wpPostId: number,
  mediaId: number
): Promise<boolean> {
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${wpPostId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ featured_media: mediaId }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function getCurrentFeaturedImage(
  base: string,
  auth: string,
  wpPostId: number
): Promise<number | null> {
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${wpPostId}?_fields=id,featured_media`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.featured_media || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const wpUrl = process.env.WP_URL
  const wpUsername = process.env.WP_USERNAME
  const wpPassword = process.env.WP_APP_PASSWORD

  if (!wpUrl || !wpUsername || !wpPassword) {
    return NextResponse.json({ error: 'WP_URL / WP_USERNAME / WP_APP_PASSWORD not set in Cloudflare env' }, { status: 500 })
  }

  const base = wpUrl.replace(/\/$/, '').replace(/^http:\/\//, 'https://')
  const auth = btoa(`${wpUsername}:${wpPassword}`)

  const body = await req.json().catch(() => ({}))
  const { limit = 30, skip_existing = true, article_id, offset = 0 } = body

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '')!
  )

  // Single article mode
  if (article_id) {
    const { data: article } = await admin
      .from('articles')
      .select('id, title, cover_image_url, wp_post_id')
      .eq('id', article_id)
      .single()

    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!article.wp_post_id) return NextResponse.json({ error: 'Article has no wp_post_id' }, { status: 400 })
    if (!article.cover_image_url) return NextResponse.json({ error: 'Article has no cover_image_url' }, { status: 400 })

    if (skip_existing) {
      const existing = await getCurrentFeaturedImage(base, auth, article.wp_post_id)
      if (existing) return NextResponse.json({ skipped: true, reason: 'already has featured image', media_id: existing })
    }

    const mediaId = await uploadImageToWP(base, auth, article.cover_image_url, article.title)
    if (!mediaId) return NextResponse.json({ error: 'Failed to upload image to WP' }, { status: 500 })
    const ok = await setFeaturedImage(base, auth, article.wp_post_id, mediaId)
    return NextResponse.json({ updated: ok ? 1 : 0, media_id: mediaId, wp_post_id: article.wp_post_id })
  }

  // Bulk mode: articles with cover image + wp_post_id, most recent first
  const { data: articles } = await admin
    .from('articles')
    .select('id, title, cover_image_url, wp_post_id')
    .not('cover_image_url', 'is', null)
    .not('wp_post_id', 'is', null)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!articles?.length) {
    return NextResponse.json({ updated: 0, message: 'No articles with both cover_image_url and wp_post_id' })
  }

  type Result = { id: string; title: string; wp_post_id: number; ok: boolean; skipped?: boolean; media_id?: number; error?: string }
  const results: Result[] = []

  for (const article of articles) {
    try {
      // Skip if WP post already has a featured image
      if (skip_existing) {
        const existing = await getCurrentFeaturedImage(base, auth, article.wp_post_id)
        if (existing) {
          results.push({ id: article.id, title: article.title, wp_post_id: article.wp_post_id, ok: true, skipped: true })
          continue
        }
      }

      const mediaId = await uploadImageToWP(base, auth, article.cover_image_url, article.title)
      if (!mediaId) {
        results.push({ id: article.id, title: article.title, wp_post_id: article.wp_post_id, ok: false, error: 'upload failed' })
        continue
      }

      const ok = await setFeaturedImage(base, auth, article.wp_post_id, mediaId)
      results.push({ id: article.id, title: article.title, wp_post_id: article.wp_post_id, ok, media_id: mediaId })

      // Small delay to avoid hammering WP
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      results.push({ id: article.id, title: article.title, wp_post_id: article.wp_post_id, ok: false, error: String(e) })
    }
  }

  const updated = results.filter(r => r.ok && !r.skipped).length
  const skipped = results.filter(r => r.skipped).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({ updated, skipped, failed, total: articles.length, results })
}
