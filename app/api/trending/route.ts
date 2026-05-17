import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const region = new URL(req.url).searchParams.get('region') || 'India'
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `List 5 trending news topics right now for ${region}. Return ONLY a valid JSON array:\n[{"title":"topic","summary":"one sentence","category":"Technology","keywords":["kw1","kw2"]}]`
            }]
          }]
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Gemini API error', details: data }, { status: 500 })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ error: 'No JSON in response', raw: text }, { status: 500 })

    const topics = JSON.parse(match[0])
    return NextResponse.json({ topics })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
