// app/api/ai/rewrite-from-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

function stripBoilerplate(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
}

function extractArticleText(html: string): string {
  const cleaned = stripBoilerplate(html)

  // Prefer scoping to <article> if the page has one
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
  const scoped = articleMatch ? articleMatch[1] : cleaned

  const pMatches = scoped.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
  const paragraphs = pMatches
    .map(p => decodeEntities(p.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 40) // drop short nav/footer/caption fragments

  return paragraphs.join('\n\n')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, target_language } = await req.json().catch(() => ({}))
  if (!url || !url.trim()) {
    return NextResponse.json({ error: 'Article URL is required' }, { status: 400 })
  }

  let html = ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendingVerseBot/1.0; +https://trendingverse.online)' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch the URL (HTTP ${res.status})` }, { status: 400 })
    }
    html = await res.text()
  } catch {
    return NextResponse.json({ error: 'Could not reach this URL — the site may be blocking automated requests' }, { status: 400 })
  }

  const extracted = extractArticleText(html)
  if (extracted.length < 200) {
    return NextResponse.json({
      error: 'Could not extract enough article content from this page. Try copy-pasting the article text directly instead.',
    }, { status: 400 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!
  const lang = (target_language || 'English').trim()

  const prompt = `You are a professional journalist and translator working for an Indian news platform.

Below is raw text extracted from a news article webpage. Your task:

1. Detect the SOURCE LANGUAGE of the original article text.
2. Completely REWRITE this article from scratch in ${lang}. Do NOT translate sentence-by-sentence and do NOT lightly paraphrase. Restructure the sentence order, paragraph flow, and wording so the result is a genuinely original piece of journalism — not a copy, not a literal translation, not a reworded version that mirrors the source's sentence structure.
3. All facts, names, numbers, quotes, dates and figures must remain accurate to the source. Never invent, omit, or alter facts.
4. The result must read as if it were originally written by a journalist in ${lang} for an Indian audience — natural phrasing, proper grammar, professional news tone.
5. Write a strong, accurate, original headline in ${lang} (not a translation of the source headline — a fresh original headline conveying the same news).
6. Suggest the single best-fit news category from exactly this list: Politics, Business, Technology, Entertainment, Sports, Health, Science, Lifestyle, Education, World, Crime, India, Environment.

SOURCE TEXT (extracted automatically from a webpage — ignore any leftover navigation, ads, or caption fragments and focus only on the actual article content):
"""
${extracted.slice(0, 12000)}
"""

Return ONLY valid JSON, no markdown, no commentary:
{"detected_source_language":"","title":"","content":"","category":"","word_count":0}

The "content" field must be the full rewritten article as plain paragraphs separated by a blank line (no HTML tags), written entirely in ${lang}, at least 400 words.`

  try {
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
        }),
      }
    )
    const data = await aiRes.json()
    if (data.error) return NextResponse.json({ error: 'Gemini error: ' + data.error.message }, { status: 500 })

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })

    const result = JSON.parse(match[0])
    if (!result.content || result.content.trim().length < 200) {
      return NextResponse.json({ error: 'Generated content was too short — try a different URL' }, { status: 500 })
    }

    return NextResponse.json({
      detected_source_language: result.detected_source_language || 'Unknown',
      title: result.title || '',
      content: result.content || '',
      category: result.category || '',
      word_count: (result.content || '').trim().split(/\s+/).filter(Boolean).length,
      source_url: url,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
