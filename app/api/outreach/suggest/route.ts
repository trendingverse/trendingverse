// app/api/outreach/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  // Read body FIRST before any other async calls
  const body = await req.json().catch(() => ({}))
  const { brief, campaign_summary } = body

  if (!brief && !campaign_summary) {
    return NextResponse.json({ error: 'Campaign brief required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const isAdmin = user.email === ADMIN_EMAIL
  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).single()

  if (!isAdmin && profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Access denied', role: profile?.role }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!

  // Parse brief into structured summary
  let summary = campaign_summary
  if (!summary) {
    try {
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
      const match = parseRaw.replace(/```json\n?|```/g, '').match(/\{[\s\S]*\}/)
      if (match) summary = JSON.parse(match[0])
    } catch {
      summary = { brand: 'Brand', category: 'General', regions: ['India'] }
    }
  }

  // Get existing publishers from DB
  const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)

  // Generate publisher suggestions
  try {
    const suggestRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a media buying expert for Indian digital publishers.

Campaign: ${JSON.stringify(summary)}

Suggest 8 specific Indian publisher websites perfect for this campaign. Include regional language publishers if relevant.

Return ONLY a valid JSON array with no explanation:
[{"name":"","site":"","category":"","region":"","language":"","monthly_audience":"","contact_email":"","contact_phone":"","why":"one sentence reason","fit_score":85}]` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    )

    const suggestData = await suggestRes.json()
    const raw = suggestData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)

    if (!match) {
      return NextResponse.json({
        error: 'Could not generate suggestions',
        gemini_raw: raw.slice(0, 300),
      }, { status: 500 })
    }

    const suggestions = JSON.parse(match[0])
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({
      error: 'Could not generate suggestions',
      detail: (e as Error).message,
    }, { status: 500 })
  }
}
