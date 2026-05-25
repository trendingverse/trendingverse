import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slugify, readingTime, wordCount, computeSeoScore } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  // Always filter by user_id — each publisher sees only their own articles
  let query = supabase
    .from('articles')
    .select('id,title,slug,status,is_featured,is_sponsored,category_name,author_name,view_count,seo_score,word_count,published_at,created_at,updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tag_ids, reading_time, tags, keywords, ...rest } = body

  const content = rest.content || ''
  const wc = wordCount(content)
  const rt = readingTime(content)
  const { score } = computeSeoScore(rest)
  const slug = rest.slug || (rest.title ? slugify(rest.title) : `article-${Date.now()}`)

  const payload = {
    title: rest.title || 'Untitled',
    slug,
    excerpt: rest.excerpt || '',
    content,
    cover_image_url: rest.cover_image_url || '',
    cover_image_alt: rest.cover_image_alt || '',
    category_id: rest.category_id || null,
    category_name: rest.category_name || '',
    status: rest.status || 'draft',
    is_featured: rest.is_featured || false,
    is_sponsored: rest.is_sponsored || false,
    author_name: rest.author_name || user.email?.split('@')[0] || 'Author',
    seo_title: rest.seo_title || rest.title || '',
    meta_description: rest.meta_description || '',
    focus_keyword: rest.focus_keyword || '',
    keywords: keywords || rest.keywords || [],
    schema_type: rest.schema_type || 'NewsArticle',
    ai_generated: rest.ai_generated || false,
    word_count: wc,
    reading_time_min: rt,
    seo_score: score,
    user_id: user.id, // Always set user_id
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(rest.status === 'published' ? { published_at: new Date().toISOString() } : {}),
  }

  const { data, error } = await supabase.from('articles').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Handle tags
  if (Array.isArray(tag_ids) && tag_ids.length > 0 && data?.id) {
    await supabase.from('article_tags').insert(
      tag_ids.map((tid: string) => ({ article_id: data.id, tag_id: tid }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
