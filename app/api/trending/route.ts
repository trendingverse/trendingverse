import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectTrendingTopics } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { region } = await req.json().catch(() => ({ region: 'Global' }))
  try {
    const topics = await detectTrendingTopics(region || 'Global')
    return NextResponse.json(topics)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
