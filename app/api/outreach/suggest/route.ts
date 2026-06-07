// app/api/outreach/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brief, campaign_summary } = body

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

  // Simple summary fallback if brief parsing fails
  let summary = campaign_summary || { brand: 'Brand', category: 'General', regions: ['India'] }

  if (!campaign_summary && brief) {
    try {
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Extract campaign details from this brief. Return ONLY valid JSON, no markdown:\n\n${brief}\n\n{"brand":"","product":"","category":"","target_audience":"","regions":[],"budget_range":"","campaign_type":"","key_message":""}` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          }),
        }
      )
      const pd = await parseRes.json()
      const pt = pd.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const pm = pt.replace(/```json\n?|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (pm) summary = JSON.parse(pm[0])
    } catch { /* use fallback summary */ }
  }

  // Generate suggestions using a simpler, more reliable prompt
  const prompt = `List 5 Indian news/content publisher websites suitable for this advertising campaign.

Campaign details: ${JSON.stringify(summary)}
Brief: ${brief || ''}

For each publisher provide realistic Indian contact details.

Respond with ONLY a JSON array, starting with [ and ending with ]. No other text:
[
  {
    "name": "Publisher Name",
    "site": "website.com",
    "category": "News/Technology/etc",
    "region": "Karnataka/Pan India/etc",
    "language": "Kannada/Hindi/English",
    "monthly_audience": "500K/mo",
    "contact_email": "ads@website.com",
    "contact_phone": "+91 98765 43210",
    "why": "One sentence why this publisher fits",
    "fit_score": 85
  }
]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    const data = await res.json()

    // Check for API errors
    if (data.error) {
      return NextResponse.json({ error: 'Gemini API error: ' + data.error.message }, { status: 500 })
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Try multiple parsing strategies
    let suggestions = null

    // Strategy 1: direct parse
    try { suggestions = JSON.parse(raw.trim()); } catch { /* try next */ }

    // Strategy 2: extract array
    if (!suggestions) {
      const m = raw.match(/\[[\s\S]*\]/)
      if (m) try { suggestions = JSON.parse(m[0]); } catch { /* try next */ }
    }

    // Strategy 3: clean and extract
    if (!suggestions) {
      const cleaned = raw.replace(/```json\n?|```/g, '').replace(/^\s*[\r\n]/gm, '').trim()
      const m2 = cleaned.match(/\[[\s\S]*\]/)
      if (m2) try { suggestions = JSON.parse(m2[0]); } catch { /* fail */ }
    }

    if (!suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json({
        error: 'Could not parse publisher suggestions',
        raw_preview: raw.slice(0, 400),
        gemini_status: res.status,
      }, { status: 500 })
    }

    const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({
      error: 'Could not generate suggestions',
      detail: (e as Error).message,
    }, { status: 500 })
  }
}
