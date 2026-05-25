import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function callGemini(prompt: string, apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1, maxOutputTokens: 1024 }
      })
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  // Parse numbered list or JSON array
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) } catch { /* continue */ }
  }
  // Parse numbered list: "1. Headline\n2. Headline"
  const lines = text.split('\n')
    .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((l: string) => l.length > 10 && l.length < 120)
  return lines.slice(0, 8)
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 1,
    })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  const lines = text.split('\n')
    .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((l: string) => l.length > 10)
  return lines.slice(0, 8)
}

async function callClaude(prompt: string, apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Claude error ${res.status}`)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const lines = text.split('\n')
    .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((l: string) => l.length > 10)
  return lines.slice(0, 8)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, count = 8 } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

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
  const canUsePlatformKey = plan === 'popular' || plan === 'pro' || plan === 'byoak' || isAdmin

  // Block free plan with no key
  if (plan === 'free' && !hasOwnKey && !isAdmin) {
    return NextResponse.json({
      error: 'FREE_PLAN_NO_KEY',
      message: 'Add your free Gemini API key in Settings → 🔑 API Keys to generate headlines.',
      action: 'add_key',
      link: '/admin/settings?tab=apikeys',
    }, { status: 403 })
  }

  const prompt = `Generate ${count} compelling, Google Discover-optimized news headlines for: "${topic}"
Rules: Specific, engaging, factual tone. Mix of question, how-to, list, and statement formats. 40-70 chars each.
Return a numbered list only, one headline per line.`

  const preferredModel = profile?.byoak_preferred_model || 'gemini'
  let headlines: string[] = []
  let lastError = ''

  // Try user's own key first
  if (hasOwnKey) {
    try {
      if (preferredModel === 'claude' && userClaudeKey) headlines = await callClaude(prompt, userClaudeKey)
      else if (preferredModel === 'openai' && userOpenAIKey) headlines = await callOpenAI(prompt, userOpenAIKey)
      else if (userGeminiKey) headlines = await callGemini(prompt, userGeminiKey)
      else if (userOpenAIKey) headlines = await callOpenAI(prompt, userOpenAIKey)
      else if (userClaudeKey) headlines = await callClaude(prompt, userClaudeKey)
    } catch (e) {
      lastError = (e as Error).message
    }
  }

  // Fallback to platform key for popular/pro/admin
  if (headlines.length === 0 && canUsePlatformKey) {
    const platformKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY
    if (platformKey) {
      try {
        headlines = await callGemini(prompt, platformKey)
      } catch (e) {
        lastError = (e as Error).message
      }
    }
  }

  if (headlines.length === 0) {
    return NextResponse.json({
      error: lastError.includes('429')
        ? 'Quota exceeded. Try again in a few minutes.'
        : lastError || 'Failed to generate headlines'
    }, { status: 500 })
  }

  return NextResponse.json({ headlines: headlines.slice(0, count) })
}
