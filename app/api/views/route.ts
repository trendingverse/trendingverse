import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { article_id, referrer } = await req.json()
  if (!article_id) return NextResponse.json({ error: 'article_id required' }, { status: 400 })

  const admin = createAdminClient()
  const ua = req.headers.get('user-agent') || ''
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'

  await admin.from('article_views').insert({ article_id, referrer: referrer || '', device, session_id: Math.random().toString(36).slice(2) })
  return NextResponse.json({ success: true })
}
