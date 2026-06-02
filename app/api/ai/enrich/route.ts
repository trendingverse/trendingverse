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

  // Detect language from content + title
  const sample = title + ' ' + content.slice(0, 500)
  const isKannada   = /[\u0C80-\u0CFF]/.test(sample)
  const isHindi     = /[\u0900-\u097F]/.test(sample)
  const isTelugu    = /[\u0C00-\u0C7F]/.test(sample)
  const isTamil     = /[\u0B80-\u0BFF]/.test(sample)
  const isMalayalam = /[\u0D00-\u0D7F]/.test(sample)
  const isMarathi   = /[\u0900-\u097F]/.test(sample) && /मराठी|महाराष्ट्र/.test(sample)

  const detectedLang = isKannada ? 'Kannada'
    : isMarathi   ? 'Marathi'
    : isHindi     ? 'Hindi'
    : isTelugu    ? 'Telugu'
    : isTamil     ? 'Tamil'
    : isMalayalam ? 'Malayalam'
    : 'English'

  const readTimeLabel = isKannada   ? `${readTime} ನಿಮಿಷ`
    : isHindi     ? `${readTime} मिनट`
    : isTelugu    ? `${readTime} నిమిషాలు`
    : isTamil     ? `${readTime} நிமிடங்கள்`
    : isMalayalam ? `${readTime} മിനിറ്റ്`
    : `${readTime} min read`

  const prompt = `You are an expert SEO specialist for Indian news publishers.

CRITICAL RULES — follow all strictly:
1. Respond with ONLY a valid JSON object. No markdown fences, no preamble, nothing else.
2. The article is in ${detectedLang}. ALL text fields MUST be written in ${detectedLang}.
3. Fields that MUST be in ${detectedLang}: seo_title, meta_description, focus_keyword, secondary_keywords, excerpt, discover_headline, discover_tags, readability_tips.
4. The slug field MUST always be URL-safe English only (lowercase, hyphens, no special characters).
5. Never switch to English for any text field if the article is not in English.

Article details:
Title: ${title}
Category: ${category || 'General'}
Content (first 1500 chars): ${content.slice(0, 1500)}
Word count: ${wordCount}

Return this exact JSON structure:
{
  "seo_title": "SEO-optimized title in ${detectedLang} under 60 characters",
  "meta_description": "Compelling meta description in ${detectedLang} 150-160 characters",
  "focus_keyword": "primary keyword in ${detectedLang} (2-4 words)",
  "secondary_keywords": ["keyword1 in ${detectedLang}", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-friendly-english-slug-only",
  "excerpt": "2-3 sentence summary in ${detectedLang} for RSS and social sharing",
  "discover_headline": "Google Discover headline in ${detectedLang} under 70 chars",
  "discover_tags": ["tag1 in ${detectedLang}", "tag2", "tag3", "tag4", "tag5"],
  "readability_score": 75,
  "readability_tips": ["tip in ${detectedLang}", "tip2 in ${detectedLang}"],
  "word_count": ${wordCount},
  "estimated_read_time": "${readTimeLabel}"
}`

  try {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY not set')

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are a JSON-only API. Always respond with valid JSON and nothing else. Never use markdown code fences. The article is in ${detectedLang} — ALL text fields in your response must be in ${detectedLang}. Never translate to English unless the article is in English.`
            }]
          },
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
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error('Could not parse AI response as JSON')
    }

    if (!parsed.slug) parsed.slug = slugify(title) + '-' + Date.now()

    return NextResponse.json(parsed)

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
