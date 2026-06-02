import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, category } = await req.json()
  if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 })

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

const isKannada = /[\u0C80-\u0CFF]/.test(content + title)
const isHindi = /[\u0900-\u097F]/.test(content + title)
const isTelugu = /[\u0C00-\u0C7F]/.test(content + title)
const isTamil = /[\u0B80-\u0BFF]/.test(content + title)
const isMalayalam = /[\u0D00-\u0D7F]/.test(content + title)

const detectedLang = isKannada ? 'Kannada' : isHindi ? 'Hindi' : isTelugu ? 'Telugu' :
  isTamil ? 'Tamil' : isMalayalam ? 'Malayalam' : 'English'

const prompt = `You are an expert SEO specialist for Indian news publishers.
CRITICAL RULES:
1. Respond with ONLY a valid JSON object. No markdown fences, no explanations, nothing else.
2. The article is in ${detectedLang}. ALL text fields in your JSON (seo_title, meta_description, excerpt, discover_headline, focus_keyword, secondary_keywords, discover_tags, readability_tips) MUST be written in ${detectedLang}.
3. The slug must always be URL-safe English (lowercase, hyphens only).
4. readability_score must be a number between 0-100.
5. Never switch to English unless the article is in English.

Analyze this article and generate SEO metadata:

Title: ${title}
Category: ${category || 'General'}
Content (first 1500 chars): ${content.slice(0, 1500)}
Word count: ${wordCount}

Return this exact JSON structure:
{
  "seo_title": "SEO-optimized title under 60 characters with primary keyword",
  "meta_description": "Compelling meta description 150-160 characters with call to action",
  "focus_keyword": "primary keyword phrase (2-4 words)",
  "secondary_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-friendly-slug-from-title",
  "excerpt": "2-3 sentence article summary for RSS and social sharing",
  "discover_headline": "Google Discover optimized headline - curiosity-driven, under 70 chars",
  "discover_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "readability_score": 75,
  "readability_tips": ["tip1 to improve readability", "tip2"],
  "word_count": ${wordCount},
  "estimated_read_time": "${readTime} min read"
}

Rules:
- Focus keyword must appear naturally in SEO title
- Meta description must be action-oriented
- Discover headline should be curiosity-driven
- Tags should be trending Indian news topics relevant to this article
- Readability score: 0-100 based on sentence length, vocabulary, structure
- Give 2-3 practical readability improvement tips
- slug must be URL-safe (lowercase, hyphens only)`

  try {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY not set')

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  system_instruction: { parts: [{ text: 'You are a JSON-only API. Always respond with valid JSON and nothing else. Never use markdown code fences.' }] },
  contents: [{ parts: [{ text: prompt }] }],  
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      }
    )

    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Strip markdown fences
    const cleaned = raw
      .replace(/^[\s]*`{3,}[\s]*(?:json)?[\s]*/i, '')
      .replace(/[\s]*`{3,}[\s]*$/i, '')
      .trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract JSON object
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('Could not parse AI response as JSON')
    }

    // Ensure slug is set
    if (!parsed.slug) parsed.slug = slugify(title) + '-' + Date.now()

    return NextResponse.json(parsed)

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
