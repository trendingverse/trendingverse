import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { article_id, wp_url, wp_username, wp_password, featured_media } = await req.json()

  if (!article_id || !wp_url || !wp_username || !wp_password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: article, error } = await supabase
    .from('articles')
    .select('*, categories(name)')
    .eq('id', article_id)
    .single()

  if (error || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const base = wp_url.replace(/\/$/, '')
  const auth = Buffer.from(`${wp_username}:${wp_password}`).toString('base64')

  try {
    // ── DUPLICATE CHECK ──────────────────────────────────────────
    // Check by slug
    const slugCheck = await fetch(
      `${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(article.slug)}&status=any`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (slugCheck.ok) {
      const existing = await slugCheck.json()
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({
          error: `Duplicate detected: A post with slug "${article.slug}" already exists on WordPress.`,
          duplicate: true,
          existing_url: existing[0].link,
          existing_id: existing[0].id,
        }, { status: 409 })
      }
    }

    // Check by title similarity
    const titleCheck = await fetch(
      `${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(article.title.slice(0, 30))}&status=any&per_page=5`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (titleCheck.ok) {
      const titleResults = await titleCheck.json()
      if (Array.isArray(titleResults)) {
        const exact = titleResults.find((p: { title: { rendered: string } }) =>
          p.title.rendered.toLowerCase().trim() === article.title.toLowerCase().trim()
        )
        if (exact) {
          return NextResponse.json({
            error: `Duplicate detected: A post with the same title already exists on WordPress.`,
            duplicate: true,
            existing_url: exact.link,
            existing_id: exact.id,
          }, { status: 409 })
        }
      }
    }
    // ── END DUPLICATE CHECK ───────────────────────────────────────

    // Fetch WP categories
    const catRes = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` }
    })
    const wpCats = catRes.ok ? await catRes.json() : []
    const catName = article.categories?.name || article.category_name || ''
    const matched = wpCats.find((c: { name: string; id: number }) =>
      c.name.toLowerCase() === catName.toLowerCase()
    )
    const categoryIds = matched ? [matched.id] : []

    // Push to WordPress
    const wpPayload: Record<string, unknown> = {
      title: article.title,
      content: article.content || '',
      excerpt: article.excerpt || '',
      status: 'publish',
      slug: article.slug,
      categories: categoryIds,
      ...(featured_media ? { featured_media } : {}),
      meta: {
        _yoast_wpseo_title: article.seo_title || article.title,
        _yoast_wpseo_metadesc: article.meta_description || '',
        _yoast_wpseo_focuskw: article.focus_keyword || '',
      }
    }

    const wpRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wpPayload),
    })

    const wpData = await wpRes.json()

    if (!wpRes.ok) {
      return NextResponse.json({
        error: wpData.message || 'WordPress API error',
        code: wpData.code
      }, { status: wpRes.status })
    }

    // Mark as published in Supabase
    await supabase.from('articles').update({
      status: 'published',
      published_at: new Date().toISOString(),
    }).eq('id', article_id)

    return NextResponse.json({
      success: true,
      wp_post_id: wpData.id,
      wp_url: wpData.link,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
