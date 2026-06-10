// app/api/ai/subheadings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, title } = await req.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  // Split content into paragraphs
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 50)

  if (paragraphs.length < 2) {
    return NextResponse.json({ error: 'Content too short to add subheadings' }, { status: 400 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!

  const prompt = `You are an expert content editor. Analyze this article and suggest H2 subheadings to be inserted between paragraphs.

Article Title: ${title}

Article Content (split by paragraphs, numbered):
${paragraphs.map((p: string, i: number) => `[PARAGRAPH ${i + 1}]:\n${p.slice(0, 200)}${p.length > 200 ? '...' : ''}`).join('\n\n')}

Rules:
- Suggest H2 subheadings ONLY — do NOT modify any paragraph text
- Each subheading must go BEFORE a paragraph (indicate which paragraph number)
- Do NOT add a subheading before paragraph 1 (the intro never gets a subheading)
- Suggest subheadings for every 2-3 paragraphs naturally
- Subheadings must reflect what the paragraph(s) after it are actually about
- Keep subheadings concise: 4-8 words
- Use the same language as the article content
- Do not suggest more than 6 subheadings total

Return ONLY valid JSON array:
[
  {
    "before_paragraph": 2,
    "subheading": "Subheading text here",
    "type": "h2",
    "preview": "First 8 words of the paragraph this goes before..."
  }
]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    )
    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ error: 'Could not generate subheadings' }, { status: 500 })

    const subheadings = JSON.parse(match[0])

    // Auto-inject subheadings into content
    // Sort by paragraph number descending so insertions don't shift indices
    const sorted = [...subheadings].sort((a: any, b: any) => b.before_paragraph - a.before_paragraph)
    const injected = [...paragraphs]
    for (const sh of sorted) {
      const idx = sh.before_paragraph - 1 // 0-based
      if (idx > 0 && idx < injected.length) {
        injected.splice(idx, 0, `<h2>${sh.subheading}</h2>`)
      }
    }
    const injected_content = injected.join('\n\n')

    return NextResponse.json({ subheadings, paragraph_count: paragraphs.length, injected_content })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
