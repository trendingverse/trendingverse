import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateHeadlines } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { topic, count } = await req.json()
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })
    const headlines = await generateHeadlines(topic, count || 5)
    return NextResponse.json({ headlines })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
