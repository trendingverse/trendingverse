// app/api/outreach/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brief, campaign_summary, publisher_scope } = body

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
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!
  let summary = campaign_summary || { brand: 'Brand', category: 'General', regions: ['India'] }

  if (!campaign_summary && brief) {
    try {
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Extract campaign details from this brief. Return ONLY valid JSON:\n\n${brief}\n\n{"brand":"","product":"","category":"","target_audience":"","regions":[],"budget_range":"","campaign_type":"","key_message":""}` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          }),
        }
      )
      const pd = await parseRes.json()
      const pt = pd.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const pm = pt.replace(/```json\n?|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (pm) summary = JSON.parse(pm[0])
    } catch { /* use fallback */ }
  }

  // Scope: india | global | both
  const scope = publisher_scope || 'both'
  const scopeInstruction = scope === 'india'
    ? 'Focus only on Indian publishers.'
    : scope === 'global'
    ? 'Focus on international/global publishers.'
    : 'Include a mix of Indian and international publishers.'

  const prompt = `You are a senior media buying expert. Suggest 6 publisher websites for this advertising campaign.

Campaign: ${JSON.stringify(summary)}
Brief: ${(brief || '').slice(0, 300)}

${scopeInstruction}

Return ONLY a valid JSON array. Keep each entry concise:
[{"name":"","site":"","category":"","region":"","language":"","monthly_audience":"","contact_email":"","contact_phone":"","why":"","fit_score":85}]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    )

    const data = await res.json()
    if (data.error) return NextResponse.json({ error: 'Gemini error: ' + data.error.message }, { status: 500 })

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let suggestions = null

    try { suggestions = JSON.parse(raw.trim()) } catch { /* try next */ }
    if (!suggestions) {
      const m = raw.match(/\[[\s\S]*\]/)
      if (m) try { suggestions = JSON.parse(m[0]) } catch { /* try next */ }
    }
    if (!suggestions) {
      const cleaned = raw.replace(/```json\n?|```/g, '').trim()
      const m2 = cleaned.match(/\[[\s\S]*\]/)
      if (m2) try { suggestions = JSON.parse(m2[0]) } catch { /* fail */ }
    }

    if (!suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json({ error: 'Could not parse suggestions', raw_preview: raw.slice(0, 200) }, { status: 500 })
    }

    const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: (e as Error).message }, { status: 500 })
  }
}
