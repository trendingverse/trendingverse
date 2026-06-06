// app/api/outreach/suggest/route.ts
// AI-powered publisher suggestion based on campaign brief
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const isAdmin = user.email === ADMIN_EMAIL
  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).single()
  if (!isAdmin && profile?.role !== 'advertiser') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { brief, campaign_summary } = await req.json()
  const geminiKey = process.env.GEMINI_API_KEY!

  // First parse the brief
  let summary = campaign_summary
  if (!summary) {
    const parseRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Extract campaign details from this brief as JSON only:\n\n${brief}\n\nReturn: {"brand":"","product":"","category":"","target_audience":"","regions":[],"budget_range":"","campaign_type":"","key_message":""}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    )
    const parseData = await parseRes.json()
    const parseRaw = parseData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    try {
      const match = parseRaw.replace(/```json\n?|```/g, '').match(/\{[\s\S]*\}/)
      if (match) summary = JSON.parse(match[0])
    } catch { summary = { brand: 'Brand', category: 'General', regions: ['India'] } }
  }

  // Check existing publishers in DB first
  const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)

  // Generate AI suggestions
  const suggestRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are a media buying expert for Indian digital publishers.

Campaign: ${JSON.stringify(summary)}

Suggest 8 specific Indian publisher websites perfect for this campaign. Include regional language publishers if the campaign targets regional audiences. Be specific with real or realistic Indian publisher names.

Return ONLY JSON array:
[{"name":"","site":"","category":"","region":"","language":"","monthly_audience":"","contact_email":"","contact_phone":"","why":"one sentence","fit_score":85}]` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  )
  const suggestData = await suggestRes.json()
  const raw = suggestData.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ error: 'Could not generate suggestions' }, { status: 500 })

  const suggestions = JSON.parse(match[0])
  return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })
}
