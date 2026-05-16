import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSeoEnhancement } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    if (!body.title || !body.content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })
    const result = await generateSeoEnhancement(body)
    return NextResponse.json(result)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
