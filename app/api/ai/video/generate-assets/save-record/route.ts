// app/api/video/save-record/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { article_id, article_title, format, file_url, file_size_kb, voiceover_included, metadata } = body
  if (!file_url) return NextResponse.json({ error: 'file_url required' }, { status: 400 })

  const { data, error } = await supabase.from('generated_videos').insert({
    article_id: article_id || null,
    article_title: article_title || '',
    format,
    file_url,
    file_size_kb,
    voiceover_included: !!voiceover_included,
    youtube_title: metadata?.youtube_title || null,
    youtube_description: metadata?.youtube_description || null,
    youtube_tags: metadata?.youtube_tags || null,
    instagram_caption: metadata?.instagram_caption || null,
    discover_keywords: metadata?.discover_keywords || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, video: data })
}
