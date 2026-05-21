import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — fetch user's saved API keys (masked)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_profiles')
    .select('byoak_gemini_key, byoak_openai_key, byoak_claude_key, byoak_preferred_model, plan')
    .eq('id', user.id)
    .single()

  // Mask keys — only show last 4 chars
  const mask = (key: string | null) => key ? '••••••••••••••••' + key.slice(-4) : ''

  return NextResponse.json({
    gemini_key: mask(data?.byoak_gemini_key),
    openai_key: mask(data?.byoak_openai_key),
    claude_key: mask(data?.byoak_claude_key),
    preferred_model: data?.byoak_preferred_model || 'gemini',
    plan: data?.plan || 'free',
    has_gemini: !!data?.byoak_gemini_key,
    has_openai: !!data?.byoak_openai_key,
    has_claude: !!data?.byoak_claude_key,
  })
}

// POST — save user's API keys
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gemini_key, openai_key, claude_key, preferred_model } = await req.json()

  const updates: Record<string, string> = {}
  if (gemini_key && !gemini_key.startsWith('••')) updates.byoak_gemini_key = gemini_key.trim()
  if (openai_key && !openai_key.startsWith('••')) updates.byoak_openai_key = openai_key.trim()
  if (claude_key && !claude_key.startsWith('••')) updates.byoak_claude_key = claude_key.trim()
  if (preferred_model) updates.byoak_preferred_model = preferred_model

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No keys to update' }, { status: 400 })
  }

  const { error } = await supabase.from('user_profiles').update(updates).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE — remove a specific key
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key_type } = await req.json()
  const fieldMap: Record<string, string> = {
    gemini: 'byoak_gemini_key',
    openai: 'byoak_openai_key',
    claude: 'byoak_claude_key',
  }
  const field = fieldMap[key_type]
  if (!field) return NextResponse.json({ error: 'Invalid key type' }, { status: 400 })

  await supabase.from('user_profiles').update({ [field]: null }).eq('id', user.id)
  return NextResponse.json({ success: true })
}
