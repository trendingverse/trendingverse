import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { slugify, readingTime, wordCount, computeSeoScore } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('articles')
    .select('*, categories(name,slug,color), article_tags(tag_id, tags(id,name,slug))')
    .eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { tag_ids, reading_time, tags, keywords, ...rest } = body
  const content = rest.content || ''
  const wc = wordCount(content)
  const rt = readingTime(content)
  const { score } = computeSeoScore(rest)
  const slug = rest.slug || (rest.title ? slugify(rest.title) : undefined)
  const payload = {
    title: rest.title,
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
    author_name: rest.author_name || 'TrendingVerse Desk',
    seo_title: rest.seo_title || rest.title,
    meta_description: rest.meta_description || '',
    focus_keyword: rest.focus_keyword || '',
    keywords: keywords || rest.keywords || [],
    schema_type: rest.schema_type || 'NewsArticle',
    ai_generated: rest.ai_generated || false,
    word_count: wc,
    reading_time_min: rt,
    seo_score: score,
    updated_at: new Date().toISOString(),
    ...(rest.status === 'published' && !rest.published_at
      ? { published_at: new Date().toISOString() } : {}),
    ...(rest.scheduled_at ? { scheduled_at: rest.scheduled_at } : {}),
  }
  const { data, error } = await supabase.from('articles').update(payload).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (Array.isArray(tag_ids)) {
    await supabase.from('article_tags').delete().eq('article_id', id)
    if (tag_ids.length > 0) {
      await supabase.from('article_tags').insert(tag_ids.map((tid: string) => ({ article_id: id, tag_id: tid })))
    }
  }
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  // Whitelist only valid columns — never spread unknown fields
  const { tag_ids, reading_time, tags, ...rest } = body
  const allowed = {
    ...(rest.title !== undefined && { title: rest.title }),
    ...(rest.slug !== undefined && { slug: rest.slug }),
    ...(rest.excerpt !== undefined && { excerpt: rest.excerpt }),
    ...(rest.content !== undefined && { content: rest.content }),
    ...(rest.status !== undefined && { status: rest.status }),
    ...(rest.is_featured !== undefined && { is_featured: rest.is_featured }),
    ...(rest.is_sponsored !== undefined && { is_sponsored: rest.is_sponsored }),
    ...(rest.category_id !== undefined && { category_id: rest.category_id }),
    ...(rest.category_name !== undefined && { category_name: rest.category_name }),
    ...(rest.cover_image_url !== undefined && { cover_image_url: rest.cover_image_url }),
    ...(rest.cover_image_alt !== undefined && { cover_image_alt: rest.cover_image_alt }),
    ...(rest.seo_title !== undefined && { seo_title: rest.seo_title }),
    ...(rest.meta_description !== undefined && { meta_description: rest.meta_description }),
    ...(rest.focus_keyword !== undefined && { focus_keyword: rest.focus_keyword }),
    ...(rest.keywords !== undefined && { keywords: rest.keywords }),
    ...(rest.published_at !== undefined && { published_at: rest.published_at }),
    ...(rest.scheduled_at !== undefined && { scheduled_at: rest.scheduled_at }),
    ...(rest.author_name !== undefined && { author_name: rest.author_name }),
    updated_at: new Date().toISOString(),
  }
  // Auto-set published_at when publishing
  if (rest.status === 'published' && !rest.published_at) {
    Object.assign(allowed, { published_at: new Date().toISOString() })
  }
  const { data, error } = await supabase.from('articles').update(allowed).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Sync tags if provided
  if (Array.isArray(tag_ids)) {
    await supabase.from('article_tags').delete().eq('article_id', id)
    if (tag_ids.length > 0) {
      await supabase.from('article_tags').insert(tag_ids.map((tid: string) => ({ article_id: id, tag_id: tid })))
    }
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
