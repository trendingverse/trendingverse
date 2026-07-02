// app/api/ai/enrich/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSeoScore } from '@/lib/seo-scorer'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, category } = await req.json()
  if (!title || !content) return NextResponse.json({ error: 'title and content are required' }, { status: 400 })

  const geminiKey = process.env.GEMINI_API_KEY!
  const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length

  // Use flash-lite for metadata generation — it's a structured extraction task,
  // not creative writing, so the cheaper model is more than sufficient.
  const prompt = `You are an expert SEO editor for TrendingVerse, an Indian news platform.

Analyze this article and generate optimized metadata. The metadata must satisfy these specific SEO requirements:
- seo_title: 50-60 characters EXACTLY, focus keyword near the start
- meta_description: 150-160 characters EXACTLY, include a call to action, end with "- TrendingVerse"
- focus_keyword: 2-4 words, a phrase someone would actually type into Google to find this article
- secondary_keywords: 6-8 related phrases
- slug: URL-safe, 4-8 words, no stop words, keyword-first
- excerpt: 80-120 characters, compelling, includes focus keyword
- discover_headline: 45-70 characters, curiosity-driven, emotionally engaging, accurate — NOT clickbait
- discover_tags: 5-8 short tags for Google Discover topic matching
- estimated_read_time: format like "4 min read"

Article Title: ${title}
Category: ${category || 'General'}
Article (first 800 words): ${content.replace(/<[^>]+>/g, ' ').split(/\s+/).slice(0, 800).join(' ')}

Return ONLY valid JSON:
{
  "seo_title": "",
  "meta_description": "",
  "focus_keyword": "",
  "secondary_keywords": [],
  "slug": "",
  "excerpt": "",
  "discover_headline": "",
  "discover_tags": [],
  "estimated_read_time": ""
}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    )
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse metadata from AI response')
    const meta = JSON.parse(match[0])

    // ── Algorithmic SEO score — zero AI cost ──────────────────
    const scoreResult = computeSeoScore({
      title: meta.seo_title || title,
      content,
      metaDescription: meta.meta_description || '',
      focusKeyword: meta.focus_keyword || '',
      excerpt: meta.excerpt || '',
    })

    return NextResponse.json({
      ...meta,
      word_count: wordCount,
      // Algorithmic score replaces the old AI-estimated one
      readability_score: scoreResult.total,
      seo_grade: scoreResult.grade,
      seo_factors: scoreResult.factors,
      readability_tips: scoreResult.tips,
      formatted_content: content, // preserve original content
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
