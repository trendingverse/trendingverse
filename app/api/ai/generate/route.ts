import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const LANGUAGES: Record<string, string> = {
  'en': 'English', 'hi': 'Hindi (हिंदी)', 'ta': 'Tamil (தமிழ்)',
  'te': 'Telugu (తెలుగు)', 'kn': 'Kannada (ಕನ್ನಡ)', 'ml': 'Malayalam (മലയാളം)',
  'mr': 'Marathi (मराठी)', 'gu': 'Gujarati (ગુજરાતી)', 'bn': 'Bengali (বাংলা)', 'pa': 'Punjabi (ਪੰਜਾਬੀ)',
}

function buildPrompt(subject: string, category: string, keywords: string[], tone: string, langName: string, wordCount: number) {
  return `Expert journalist. Write original SEO news article in ${langName}.
Topic: ${subject}
Category: ${category}
Keywords: ${keywords.slice(0, 5).join(', ')}
Tone: ${tone} | Length: ${wordCount} words
Rules: Original reporting only. No copied content. No trademarked phrases. AdSense safe. E-E-A-T compliant. H2/H3 structure. Google Discover optimised.
Return ONLY raw JSON (no markdown, no backticks):
{"title":"headline","content":"<p>html</p>","excerpt":"2-3 sentences","seo_title":"50-60 chars","meta_description":"150-160 chars","focus_keyword":"main kw","keywords":["k1","k2","k3"],"tags":["t1","t2"],"reading_time":4}`
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 3000, responseMimeType: 'application/json' }
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
      max_tokens: 3000,
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
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
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
  const clean = text.replace(/```json\n?|```/g, '').trim()
  try { return JSON.parse(clean) } catch { /* continue */ }
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)) } catch { /* continue */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, topic, keywords = [], category = 'General', tone = 'journalistic', wordCount = 700, language = 'en' } = body
  const langName = LANGUAGES[language] || 'English'
  const subject = title || topic || 'Latest trending news'

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

  // ── FREE PLAN: must have own API key ──────────────────────────
  if (plan === 'free' && !hasOwnKey && !isAdmin) {
    return NextResponse.json({
      error: 'FREE_PLAN_NO_KEY',
      message: 'Free plan requires your own API key to generate articles. Add your free Gemini API key in Settings → 🔑 API Keys.',
      action: 'add_key',
      link: '/admin/settings?tab=apikeys',
    }, { status: 403 })
  }

  // ── POPULAR/PRO/ADMIN: can use platform key ───────────────────
  const canUsePlatformKey = plan === 'popular' || plan === 'pro' || plan === 'byoak' || isAdmin

  const preferredModel = profile?.byoak_preferred_model || 'gemini'
  const prompt = buildPrompt(subject, category, Array.isArray(keywords) ? keywords : [], tone, langName, wordCount)

  let rawText = ''
  let modelUsed = ''
  let lastError = ''

  // Try user's own keys first (all plans)
  const tryUserKeys = async () => {
    if (preferredModel === 'claude' && userClaudeKey) {
      modelUsed = 'Claude 3.5 Haiku'; return generateWithClaude(prompt, userClaudeKey)
    }
    if (preferredModel === 'openai' && userOpenAIKey) {
      modelUsed = 'GPT-4o Mini'; return generateWithOpenAI(prompt, userOpenAIKey)
    }
    if (preferredModel === 'gemini' && userGeminiKey) {
      modelUsed = 'Gemini (your key)'; return generateWithGemini(prompt, userGeminiKey)
    }
    // Any available user key
    if (userGeminiKey) { modelUsed = 'Gemini (your key)'; return generateWithGemini(prompt, userGeminiKey) }
    if (userOpenAIKey) { modelUsed = 'GPT-4o Mini'; return generateWithOpenAI(prompt, userOpenAIKey) }
    if (userClaudeKey) { modelUsed = 'Claude 3.5 Haiku'; return generateWithClaude(prompt, userClaudeKey) }
    throw new Error('No user key available')
  }

  // Try user keys
  if (hasOwnKey) {
    try {
      rawText = await tryUserKeys()
    } catch (e) {
      lastError = (e as Error).message
    }
  }

  // Fallback to platform key (popular/pro/admin only)
  if (!rawText && canUsePlatformKey) {
    const key = platformKey2 || platformKey
    if (key) {
      try {
        modelUsed = 'Gemini (platform)'
        rawText = await generateWithGemini(prompt, key)
      } catch (e) {
        lastError = (e as Error).message
      }
    }
  }

  if (!rawText) {
    // User key failed — give helpful error
    if (hasOwnKey && lastError.includes('429')) {
      return NextResponse.json({
        error: 'Your API key quota is exceeded. Try again in a few minutes or add a backup key in Settings → 🔑 API Keys.'
      }, { status: 429 })
    }
    if (!canUsePlatformKey && !hasOwnKey) {
      return NextResponse.json({
        error: 'FREE_PLAN_NO_KEY',
        message: 'Add your free Gemini API key in Settings → 🔑 API Keys to start generating articles.',
        action: 'add_key',
        link: '/admin/settings?tab=apikeys',
      }, { status: 403 })
    }
    return NextResponse.json({
      error: lastError.includes('429')
        ? 'All API keys are quota-exceeded. Try again later or add your own key in Settings → 🔑 API Keys.'
        : lastError || 'Generation failed. Please try again.'
    }, { status: 500 })
  }

  const article = parseJSON(rawText)
  if (!article) return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 })

  return NextResponse.json({
    title: article.title || subject,
    content: article.content || '',
    excerpt: article.excerpt || '',
    seo_title: article.seo_title || article.title || subject,
    meta_description: article.meta_description || '',
    focus_keyword: article.focus_keyword || '',
    keywords: article.keywords || keywords || [],
    tags: article.tags || [],
    reading_time: article.reading_time || 4,
    language,
    language_name: langName,
    model_used: modelUsed,
  })
}
