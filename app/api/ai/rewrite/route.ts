import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rewriteContent } from '@/lib/ai/gemini'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { content, instruction } = await req.json()
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
    const result = await rewriteContent(content, instruction || 'Improve readability and engagement')
    return NextResponse.json({ content: result })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
