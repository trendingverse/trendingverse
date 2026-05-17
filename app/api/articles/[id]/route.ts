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
  const { tag_ids, reading_time, tags, ...updateData } = body
  const { tag_ids, ...rest } = body

  const content = rest.content || ''
  const wc = wordCount(content)
  const rt = readingTime(content)
  const { score } = computeSeoScore(rest)

  const slug = rest.slug || (rest.title ? slugify(rest.title) : undefined)
  const payload = {
    ...rest, slug, word_count: wc, reading_time_min: rt, seo_score: score,
    updated_at: new Date().toISOString(),
    ...(rest.status === 'published' && !rest.published_at ? { published_at: new Date().toISOString() } : {}),
  }

  const { data, error } = await supabase.from('articles').update(payload).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync tags
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
  const { data, error } = await supabase.from('articles')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
