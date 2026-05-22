import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function fetchTrends(apiKey: string, region: string) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Today is ${today}. List 6 specific trending news topics RIGHT NOW for ${region}. Be specific — real names, real events happening today.
Return ONLY valid JSON array:
[{"title":"Specific trending topic","summary":"one sentence context","category":"Technology","keywords":["kw1","kw2","kw3"]}]`
          }]
        }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
      }),
      cache: 'no-store'
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Gemini error ${res.status}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.replace(/```json\n?|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const region = new URL(req.url).searchParams.get('region') || 'India'

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('byoak_gemini_key, byoak_openai_key, byoak_claude_key, plan')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === process.env.ADMIN_EMAIL
  const plan = profile?.plan || 'free'
  const userGeminiKey = profile?.byoak_gemini_key
  const hasOwnKey = !!(userGeminiKey || profile?.byoak_openai_key || profile?.byoak_claude_key)
  const canUsePlatformKey = plan === 'popular' || plan === 'pro' || plan === 'byoak' || isAdmin

  // Block free plan with no key
  if (plan === 'free' && !hasOwnKey && !isAdmin) {
    return NextResponse.json({
      error: 'FREE_PLAN_NO_KEY',
      message: 'Add your free Gemini API key in Settings → 🔑 API Keys to detect trending topics.',
      action: 'add_key',
      link: '/admin/settings?tab=apikeys',
    }, { status: 403 })
  }

  let topics: unknown[] = []
  let lastError = ''

  // Try user's own Gemini key first
  if (userGeminiKey) {
    try {
      topics = await fetchTrends(userGeminiKey, region)
    } catch (e) {
      lastError = (e as Error).message
    }
  }

  // Fallback to platform key for popular/pro/admin
  if (topics.length === 0 && canUsePlatformKey) {
    const platformKey = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY
    if (platformKey) {
      try {
        topics = await fetchTrends(platformKey, region)
      } catch (e) {
        lastError = (e as Error).message
      }
    }
  }

  if (topics.length === 0) {
    return NextResponse.json({
      error: lastError.includes('429')
        ? 'Quota exceeded. Try again in a few minutes.'
        : lastError || 'Failed to fetch trends'
    }, { status: 500 })
  }

  return NextResponse.json({ topics })
}
