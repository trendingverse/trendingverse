import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const LANGUAGES: Record<string, string> = {
  'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil',
  'te': 'Telugu', 'kn': 'Kannada', 'ml': 'Malayalam',
  'mr': 'Marathi', 'gu': 'Gujarati', 'bn': 'Bengali', 'pa': 'Punjabi',
}

function buildPrompt(subject: string, category: string, keywords: string[], tone: string, langName: string, wordCount: number) {
  return `You are an expert journalist. Write a ${wordCount} word SEO news article about: ${subject}
Category: ${category} | Keywords: ${keywords.slice(0,5).join(', ')} | Tone: ${tone}
Write ALL text content in ${langName} language.
Respond with ONLY a JSON object in this exact format (no other text):
{"title":"[${langName} headline]","content":"[HTML article in ${langName} using p h2 h3 strong tags]","excerpt":"[${langName} summary]","seo_title":"[${langName} SEO title under 60 chars]","meta_description":"[${langName} meta under 160 chars]","focus_keyword":"[main keyword]","keywords":["kw1","kw2","kw3"],"tags":["tag1","tag2"],"reading_time":4}`
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
       generationConfig: {
  temperature: 0.9,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json'
}
      })
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p: {text?: string}) => p.text).map((p: {text: string}) => p.text).join('')
  // Gemini with responseMimeType returns clean JSON — parse directly
  return JSON.parse(text)
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<Record<string, unknown>> {
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
  const text = data.choices?.[0]?.message?.content || ''
  return JSON.parse(text)
}

async function generateWithClaude(prompt: string, apiKey: string): Promise<Record<string, unknown>> {
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
  const text = (data.content?.[0]?.text || '').trim()

  // Try all parsing methods
  // 1. Direct parse
  try { return JSON.parse(text) } catch { /* continue */ }

  // 2. Strip markdown fences
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }

  // 3. Extract between first { and last }
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)) } catch { /* continue */ }
  }

  // 4. Unicode escape for Indian languages
  if (start !== -1 && end > start) {
    try {
      const unicoded = stripped.slice(start, end + 1).replace(/[\u0080-\uFFFF]/g, c =>
        '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
      )
      return JSON.parse(unicoded)
    } catch { /* continue */ }
  }

  // 5. Manual field extraction — works even if JSON is malformed
  const extract = stripped.slice(Math.max(0, start), end + 1)
  const getStr = (key: string) => {
    const m = extract.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`, 's'))
    if (!m) return ''
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  }
  const getArr = (key: string) => {
    const m = extract.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`))
    return m ? (m[1].match(/"([^"]*)"/g) || []).map((s: string) => s.replace(/"/g, '')) : []
  }

  const title = getStr('title')
  if (!title) throw new Error('Claude returned non-JSON response')

  return {
    title,
    content: getStr('content'),
    excerpt: getStr('excerpt'),
    seo_title: getStr('seo_title'),
    meta_description: getStr('meta_description'),
    focus_keyword: getStr('focus_keyword'),
    keywords: getArr('keywords'),
    tags: getArr('tags'),
    reading_time: 4,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title, topic, keywords = [], category = 'General',
    tone = 'journalistic', wordCount = 700, language = 'en'
  } = body
  const langName = LANGUAGES[language] || 'English'
  const subject = title || topic || 'Latest trending news'
  const kws = Array.isArray(keywords) ? keywords : []

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
      message: 'Free plan requires your own API key. Add your Gemini key in Settings → API Keys.',
      action: 'add_key',
      link: '/admin/settings?tab=apikeys',
    }, { status: 403 })
  }

  const preferredModel = profile?.byoak_preferred_model || 'gemini'
  const prompt = buildPrompt(subject, category, kws, tone, langName, wordCount)

  let article: Record<string, unknown> | null = null
  let modelUsed = ''
  let lastError = ''

  // Try user's own keys first
  if (hasOwnKey) {
    try {
      if (preferredModel === 'claude' && userClaudeKey) {
        modelUsed = 'Claude Haiku 4.5'
        article = await generateWithClaude(prompt, userClaudeKey)
      } else if (preferredModel === 'openai' && userOpenAIKey) {
        modelUsed = 'GPT-4o Mini'
        article = await generateWithOpenAI(prompt, userOpenAIKey)
      } else if (userGeminiKey) {
        modelUsed = 'Gemini 2.5 Flash (your key)'
        article = await generateWithGemini(prompt, userGeminiKey)
      } else if (userOpenAIKey) {
        modelUsed = 'GPT-4o Mini'
        article = await generateWithOpenAI(prompt, userOpenAIKey)
      } else if (userClaudeKey) {
        modelUsed = 'Claude Haiku 4.5'
        article = await generateWithClaude(prompt, userClaudeKey)
      }
    } catch (e) {
      lastError = (e as Error).message
    }
  }

  // Fallback to platform key
  if (!article && canUsePlatformKey) {
    const key = platformKey2 || platformKey
    if (key) {
      try {
        modelUsed = 'Gemini 2.5 Flash'
        article = await generateWithGemini(prompt, key)
      } catch (e) {
        lastError = (e as Error).message
      }
    }
  }

  if (!article) {
    return NextResponse.json({
      error: lastError.includes('429')
        ? 'API quota exceeded. Try again in a few minutes.'
        : lastError || 'Generation failed. Please try again.'
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
