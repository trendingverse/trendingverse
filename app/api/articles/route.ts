import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slugify, readingTime, wordCount, computeSeoScore } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '50')
  let query = supabase.from('articles')
    .select('*, categories(name,slug,color), article_tags(tags(name,slug))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category_id', category)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const content = body.content || ''
  const wc = wordCount(content)
  const rt = readingTime(content)
  const { score } = computeSeoScore(body)

  // Get category name
  let category_name = body.category_name
  if (body.category_id && !category_name) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', body.category_id).single()
    category_name = cat?.name
  }

  const slug = body.slug || slugify(body.title)

  // WHITELIST only valid database columns — never spread body directly
  const payload = {
    title: body.title,
    slug,
    excerpt: body.excerpt || '',
    content,
    cover_image_url: body.cover_image_url || '',
    cover_image_alt: body.cover_image_alt || '',
    category_id: body.category_id || null,
    category_name: category_name || '',
    status: body.status || 'draft',
    is_featured: body.is_featured || false,
    is_sponsored: body.is_sponsored || false,
    sponsor_name: body.sponsor_name || '',
    sponsor_disclosure: body.sponsor_disclosure || '',
    author_id: user.id,
    author_name: body.author_name || 'TrendingVerse Desk',
    seo_title: body.seo_title || body.title,
    meta_description: body.meta_description || '',
    focus_keyword: body.focus_keyword || '',
    keywords: body.keywords || [],
    schema_type: body.schema_type || 'NewsArticle',
    ai_generated: body.ai_generated || false,
    word_count: wc,
    reading_time_min: rt,
    seo_score: score,
    has_affiliate_links: false,
    ...(body.status === 'published'
      ? { published_at: body.published_at || new Date().toISOString() }
      : {}),
    ...(body.scheduled_at ? { scheduled_at: body.scheduled_at } : {}),
  }

  const { data, error } = await supabase.from('articles').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert tags separately via junction table
  const tag_ids = body.tag_ids
  if (Array.isArray(tag_ids) && tag_ids.length > 0 && data) {
    await supabase.from('article_tags').insert(
      tag_ids.map((tid: string) => ({ article_id: data.id, tag_id: tid }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
