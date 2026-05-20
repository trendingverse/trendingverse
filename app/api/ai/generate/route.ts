import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LANGUAGES: Record<string, string> = {
  'en': 'English',
  'hi': 'Hindi (हिंदी)',
  'ta': 'Tamil (தமிழ்)',
  'te': 'Telugu (తెలుగు)',
  'kn': 'Kannada (ಕನ್ನಡ)',
  'ml': 'Malayalam (മലയാളം)',
  'mr': 'Marathi (मराठी)',
  'gu': 'Gujarati (ગુજરાతી)',
  'bn': 'Bengali (বাংলা)',
  'pa': 'Punjabi (ਪੰਜਾਬੀ)',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  const { title, topic, keywords = [], category = 'General', tone = 'journalistic', wordCount = 700, language = 'en' } = body
  const langName = LANGUAGES[language] || 'English'
  const subject = title || topic || 'Latest trending news'

  const prompt = `You are a senior journalist for TrendingVerse news portal.
Write a complete, original, SEO-optimized news article in ${langName}.
Title/Topic: ${subject}
Category: ${category}
Keywords: ${keywords.join(', ')}
Tone: ${tone}
Language: Write entirely in ${langName}
Word count: ${wordCount}-${wordCount + 200} words
Requirements: Professional journalistic tone, E-E-A-T compliant, Google Discover ready, no AI spam, Google AdSense safe, proper H2/H3 structure.
Return ONLY valid JSON (no markdown, no backticks):
{"title":"Compelling headline in ${langName}","content":"Full article HTML using only p h2 h3 strong em ul li","excerpt":"2-3 sentence summary","seo_title":"SEO title 50-60 chars","meta_description":"150-160 chars with keyword","focus_keyword":"primary keyword","keywords":["kw1","kw2","kw3","kw4","kw5"],"tags":["tag1","tag2","tag3"],"reading_time":4}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 4096 }
        })
      }
    )

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message || 'Gemini API error' }, { status: res.status })
    }

    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('').replace(/```json\n?|```/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    const article = JSON.parse(match[0])
    return NextResponse.json({ ...article, language, language_name: langName })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
