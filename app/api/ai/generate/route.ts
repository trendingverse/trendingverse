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
  'gu': 'Gujarati (ગુજરાતી)',
  'bn': 'Bengali (বাংলা)',
  'pa': 'Punjabi (ਪੰਜਾਬੀ)',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const apiKey = process.env.GEMINI_API_KEY
  const apiKey2 = process.env.GEMINI_API_KEY_2
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  const {
    title, topic, keywords = [], category = 'General',
    tone = 'journalistic', wordCount = 700, language = 'en'
  } = body

  const langName = LANGUAGES[language] || 'English'
  const subject = title || topic || 'Latest trending news'

  const prompt = `You are a senior journalist. Write a complete SEO-optimized news article in ${langName}.

Topic: ${subject}
Category: ${category}
Keywords: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}
Tone: ${tone}
Language: ${langName}
Length: ${wordCount}-${wordCount + 200} words

Rules:
- Write entirely in ${langName}
- Professional journalistic tone
- Use H2 and H3 subheadings
- Google Discover ready
- AdSense safe content
- No AI filler phrases

You MUST respond with ONLY a raw JSON object. No markdown. No backticks. No explanation. Just the JSON:
{"title":"headline here","content":"<p>article html here</p>","excerpt":"2-3 sentence summary","seo_title":"seo title 50-60 chars","meta_description":"meta desc 150-160 chars","focus_keyword":"main keyword","keywords":["kw1","kw2","kw3","kw4","kw5"],"tags":["tag1","tag2","tag3"],"reading_time":4}`

  // Try primary key first, fallback to secondary
  async function callGemini(key: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          }
        })
      }
    )
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `Gemini API error ${res.status}`)
    }
    return res.json()
  }

  function extractJSON(text: string): Record<string, unknown> | null {
    // Remove markdown code blocks
    let clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Try direct parse first
    try { return JSON.parse(clean) } catch { /* continue */ }

    // Find JSON object — try from first { to last }
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(clean.slice(start, end + 1)) } catch { /* continue */ }
    }

    // Try regex match for JSON with required fields
    const patterns = [
      /\{[\s\S]*?"title"[\s\S]*?"content"[\s\S]*?"excerpt"[\s\S]*?\}/,
      /\{[\s\S]*?"content"[\s\S]*?\}/,
      /\{[\s\S]*\}/,
    ]
    for (const pattern of patterns) {
      const match = clean.match(pattern)
      if (match) {
        try { return JSON.parse(match[0]) } catch { /* continue */ }
      }
    }
    return null
  }

  try {
    let data: Record<string, unknown> | null = null
    let lastError = ''

    // Try primary key
    try {
      const response = await callGemini(apiKey)
      const parts = response.candidates?.[0]?.content?.parts || []
      const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('')
      data = extractJSON(text)
    } catch (e) {
      lastError = (e as Error).message
      // Try backup key
      if (apiKey2) {
        try {
          const response = await callGemini(apiKey2)
          const parts = response.candidates?.[0]?.content?.parts || []
          const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('')
          data = extractJSON(text)
        } catch (e2) {
          lastError = (e2 as Error).message
        }
      }
    }

    if (!data) {
      return NextResponse.json({
        error: `Failed to generate article. ${lastError.includes('429') ? 'Gemini quota exceeded — try again in a few minutes.' : lastError || 'Please try again.'}`
      }, { status: 500 })
    }

    // Ensure all required fields exist
    const article = {
      title: data.title || subject,
      content: data.content || data.body || '',
      excerpt: data.excerpt || data.summary || '',
      seo_title: data.seo_title || data.title || subject,
      meta_description: data.meta_description || data.metaDescription || '',
      focus_keyword: data.focus_keyword || data.focusKeyword || (Array.isArray(keywords) ? keywords[0] : '') || '',
      keywords: data.keywords || keywords || [],
      tags: data.tags || [],
      reading_time: data.reading_time || data.readingTime || 4,
      language,
      language_name: langName,
    }

    return NextResponse.json(article)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
