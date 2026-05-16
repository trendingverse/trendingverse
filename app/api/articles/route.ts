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
  const { tag_ids, ...rest } = body

  if (!rest.title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const content = rest.content || ''
  const wc = wordCount(content)
  const rt = readingTime(content)
  const { score } = computeSeoScore(rest)

  // Get category name for denormalization
  let category_name = rest.category_name
  if (rest.category_id && !category_name) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', rest.category_id).single()
    category_name = cat?.name
  }

  const slug = rest.slug || slugify(rest.title)
  const payload = {
    ...rest, slug, category_name,
    author_id: user.id,
    word_count: wc, reading_time_min: rt, seo_score: score,
    ...(rest.status === 'published' ? { published_at: new Date().toISOString() } : {}),
  }

  const { data, error } = await supabase.from('articles').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert tags
  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await supabase.from('article_tags').insert(tag_ids.map((tid: string) => ({ article_id: data.id, tag_id: tid })))
  }

  return NextResponse.json(data, { status: 201 })
}
