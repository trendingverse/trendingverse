import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const LANGUAGES: Record<string, string> = {
  'en': 'English', 'hi': 'Hindi (हिंदी)', 'ta': 'Tamil (தமிழ்)',
  'te': 'Telugu (తెలుగు)', 'kn': 'Kannada (ಕನ್ನಡ)', 'ml': 'Malayalam (മലയാളം)',
  'mr': 'Marathi (मराठी)', 'gu': 'Gujarati (ગુજરાતી)', 'bn': 'Bengali (বাংলা)', 'pa': 'Punjabi (ਪੰਜਾਬੀ)',
}

// Prompt for Gemini and OpenAI
function buildPrompt(subject: string, category: string, keywords: string[], tone: string, langName: string, wordCount: number) {
  return `Expert journalist. Write original SEO news article in ${langName}.
Topic: ${subject}
Category: ${category}
Keywords: ${keywords.slice(0, 5).join(', ')}
Tone: ${tone} | Length: ${wordCount} words
Rules: Original reporting only. No copied content. AdSense safe. E-E-A-T compliant. H2/H3 structure.
IMPORTANT: Return ONLY the raw JSON object. No markdown. No backticks. No explanation. Start with { and end with }:
{"title":"headline in ${langName}","content":"<p>html content in ${langName}</p>","excerpt":"2-3 sentences in ${langName}","seo_title":"50-60 chars","meta_description":"150-160 chars","focus_keyword":"main kw","keywords":["k1","k2","k3"],"tags":["t1","t2"],"reading_time":4}`
}

// Separate prompt for Claude — more explicit JSON instructions
function buildClaudePrompt(subject: string, category: string, keywords: string[], tone: string, langName: string, wordCount: number) {
  return `You are an expert journalist. Write a complete SEO-optimized news article.

Topic: ${subject}
Category: ${category}
Keywords: ${keywords.slice(0, 5).join(', ')}
Tone: ${tone}
Word count: ${wordCount}
Language for all content: ${langName}

STRICT JSON RULES:
- Return ONLY a JSON object, nothing else before or after
- No markdown, no backticks, no code fences
- All content must be in ${langName}
- Newlines inside strings must be written as \\n
- Double quotes inside strings must be escaped as \\"
- HTML tags are allowed inside the content string value

JSON structure to return:
{
  "title": "article headline in ${langName}",
  "content": "<p>opening paragraph in ${langName}</p>\\n<h2>section heading in ${langName}</h2>\\n<p>body paragraph in ${langName}</p>",
  "excerpt": "2-3 sentence summary in ${langName}",
  "seo_title": "SEO optimized title under 60 characters",
  "meta_description": "meta description under 160 characters",
  "focus_keyword": "primary keyword",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "tags": ["tag1", "tag2"],
  "reading_time": 4
}`
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4096 }
      })
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  return parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('')
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function generateWithClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Claude error ${res.status}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

function parseJSON(text: string): Record<string, unknown> | null {
  if (!text) return null

  // Step 1: Clean markdown fences
  let clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Step 2: Direct parse
  try { return JSON.parse(clean) } catch { /* continue */ }

  // Step 3: Extract between first { and last }
  const firstBrace = clean.indexOf('{')
  const lastBrace = clean.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace <= firstBrace) return null
  const extracted = clean.slice(firstBrace, lastBrace + 1)
  try { return JSON.parse(extracted) } catch { /* continue */ }

  // Step 4: Unicode escape — fixes Indian language characters in broken JSON
  try {
    const unicodeEscaped = extracted.replace(/[\u0080-\uFFFF]/g, (char) => {
      return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4)
    })
    return JSON.parse(unicodeEscaped)
  } catch { /* continue */ }

  // Step 5: Fix unescaped newlines inside strings
  try {
    const noNewlines = extracted.replace(/("(?:[^"\\]|\\.)*")|(\n)/g, (match, str, nl) => {
      if (nl) return '\\n'
      return str
    })
    return JSON.parse(noNewlines)
  } catch { /* continue */ }

  // Step 6: Manual field extraction as last resort
  try {
    const getString = (key: string): string => {
      const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`, 's')
      const m = extracted.match(re)
      if (!m) return ''
      return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    }
    const getArray = (key: string): string[] => {
      const re = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`)
      const m = extracted.match(re)
      if (!m) return []
      return (m[1].match(/"([^"]*)"/g) || []).map(s => s.replace(/"/g, ''))
    }
    const getNum = (key: string): number => {
      const m = extracted.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
      return m ? parseInt(m[1]) : 4
    }
    const title = getString('title')
    if (!title) return null
    return {
      title,
      content: getString('content'),
      excerpt: getString('excerpt'),
      seo_title: getString('seo_title'),
      meta_description: getString('meta_description'),
      focus_keyword: getString('focus_keyword'),
      keywords: getArray('keywords'),
      tags: getArray('tags'),
      reading_time: getNum('reading_time'),
    }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, topic, keywords = [], category = 'General', tone = 'journalistic', wordCount = 700, language = 'en' } = body
  const langName = LANGUAGES[language] || 'English'
  const subject = title || topic || 'Latest trending news'
  const kws = Array.isArray(keywords) ? keywords : []

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('byoak_gemini_key, byoak_openai_key, byoak_claude_key, byoak_preferred_model, plan')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === process.env.ADMIN_EMAIL
  const plan = profile?.plan || 'free'
  const userGeminiKey = profile?.byoak_gemini_key
  const userOpenAIKey = profile?.byoak_openai_key
  const userClaudeKey = profile?.byoak_claude_key
  const hasOwnKey = !!(userGeminiKey || userOpenAIKey || userClaudeKey)
  const platformKey = process.env.GEMINI_API_KEY
  const platformKey2 = process.env.GEMINI_API_KEY_2
  const canUsePlatformKey = plan === 'popular' || plan === 'pro' || plan === 'byoak' || isAdmin

  if (plan === 'free' && !hasOwnKey && !isAdmin) {
    return NextResponse.json({
      error: 'FREE_PLAN_NO_KEY',
      message: 'Free plan requires your own API key. Add your free Gemini key in Settings → 🔑 API Keys.',
      action: 'add_key',
      link: '/admin/settings?tab=apikeys',
    }, { status: 403 })
  }

  const preferredModel = profile?.byoak_preferred_model || 'gemini'
  let rawText = ''
  let modelUsed = ''
  let lastError = ''

  // Try user's own keys first
  if (hasOwnKey) {
    try {
      if (preferredModel === 'claude' && userClaudeKey) {
        modelUsed = 'Claude Haiku 4.5'
        rawText = await generateWithClaude(buildClaudePrompt(subject, category, kws, tone, langName, wordCount), userClaudeKey)
      } else if (preferredModel === 'openai' && userOpenAIKey) {
        modelUsed = 'GPT-4o Mini'
        rawText = await generateWithOpenAI(buildPrompt(subject, category, kws, tone, langName, wordCount), userOpenAIKey)
      } else if (userGeminiKey) {
        modelUsed = 'Gemini 2.5 Flash (your key)'
        rawText = await generateWithGemini(buildPrompt(subject, category, kws, tone, langName, wordCount), userGeminiKey)
      } else if (userOpenAIKey) {
        modelUsed = 'GPT-4o Mini'
        rawText = await generateWithOpenAI(buildPrompt(subject, category, kws, tone, langName, wordCount), userOpenAIKey)
      } else if (userClaudeKey) {
        modelUsed = 'Claude Haiku 4.5'
        rawText = await generateWithClaude(buildClaudePrompt(subject, category, kws, tone, langName, wordCount), userClaudeKey)
      }
    } catch (e) {
      lastError = (e as Error).message
    }
  }

  // Fallback to platform key
  if (!rawText && canUsePlatformKey) {
    const key = platformKey2 || platformKey
    if (key) {
      try {
        modelUsed = 'Gemini 2.5 Flash'
        rawText = await generateWithGemini(buildPrompt(subject, category, kws, tone, langName, wordCount), key)
      } catch (e) {
        lastError = (e as Error).message
      }
    }
  }

  if (!rawText) {
    return NextResponse.json({
      error: lastError.includes('429')
        ? 'API quota exceeded. Try again in a few minutes.'
        : lastError || 'Generation failed. Please try again.'
    }, { status: 500 })
  }

  const article = parseJSON(rawText)
  if (!article || !article.title) {
    return NextResponse.json({
      error: 'Failed to parse AI response. Please try again.',
      debug: rawText.slice(0, 300)
    }, { status: 500 })
  }

  return NextResponse.json({
    title: article.title || subject,
    content: article.content || '',
    excerpt: article.excerpt || '',
    seo_title: article.seo_title || article.title || subject,
    meta_description: article.meta_description || '',
    focus_keyword: article.focus_keyword || '',
    keywords: article.keywords || kws,
    tags: article.tags || [],
    reading_time: article.reading_time || 4,
    language,
    language_name: langName,
    model_used: modelUsed,
  })
}
