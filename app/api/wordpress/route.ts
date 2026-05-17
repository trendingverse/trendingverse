import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { article_id, wp_url, wp_username, wp_password } = await req.json()

  if (!article_id || !wp_url || !wp_username || !wp_password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch article from Supabase
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
    // Fetch WP categories
    const catRes = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` }
    })
    const wpCats = catRes.ok ? await catRes.json() : []

    // Match category name
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
      ...(body.featured_media ? { featured_media: body.featured_media } : {}),
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

    // Update article with WP post ID and URL
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
