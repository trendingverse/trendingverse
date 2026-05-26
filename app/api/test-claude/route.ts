import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin
    .from('user_profiles')
    .select('byoak_claude_key')
    .eq('id', user.id)
    .single()

  const claudeKey = profile?.byoak_claude_key
  if (!claudeKey) return NextResponse.json({ error: 'No Claude key found' })

  const prompt = `Write a very short news article in Kannada (ಕನ್ನಡ) about technology.
Return ONLY this JSON structure with Kannada content:
{
  "title": "Kannada title here",
  "content": "<p>Kannada paragraph here.</p>",
  "excerpt": "Kannada summary here."
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
  })

  const data = await res.json()
  const rawText = data.content?.[0]?.text || ''

  // Try parsing
  let parsed = null
  try { parsed = JSON.parse(rawText) } catch { /* continue */ }

  if (!parsed) {
    const firstBrace = rawText.indexOf('{')
    const lastBrace = rawText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) } catch { /* continue */ }
    }
  }

  return NextResponse.json({
    raw_response: rawText,
    raw_length: rawText.length,
    first_char: rawText.charCodeAt(0),
    parsed_successfully: !!parsed,
    parsed_result: parsed,
  })
}
