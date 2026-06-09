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

  // Parse brief
  if (!campaign_summary && brief) {
    try {
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Extract campaign details from this brief. May be free text, bullets, or table format.

${brief}

Return ONLY valid JSON:
{"brand":"","product":"","category":"","target_audience":"","regions":[],"budget_range":"","campaign_type":"","key_message":"","device":"","deal_type":"","creative_length":"","integration":"","payment_terms":"","kpi":""}

IMPORTANT: 
- Parse tab-separated rows as key:value pairs
- "Geo" field = regions. Expand ALL country codes: MX=Mexico, BD=Bangladesh, IN=India, US=United States, UK=United Kingdom, AE=UAE, SG=Singapore, PH=Philippines, ID=Indonesia, MY=Malaysia, TH=Thailand, VN=Vietnam
- "Vertical" field = category
- "Mode" field = campaign_type and deal_type  
- "KPI" field = key_message and kpi
- "PO" field = budget_range
- Never default regions to India unless brief explicitly says India` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      )
      const pd = await parseRes.json()
      const pt = pd.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const pm = pt.replace(/```json\n?|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (pm) summary = JSON.parse(pm[0])
    } catch { /* use fallback */ }
  }

  // Detect signals
  const regions: string[] = Array.isArray(summary.regions) ? summary.regions : [summary.regions || 'India']
  const regionsStr = regions.join(', ').toLowerCase()
  const briefLower = (brief || '').toLowerCase()
  const isBangladesh = regionsStr.includes('bangladesh') || regionsStr.includes('dhaka')
  const isCTV = briefLower.includes('ctv') || briefLower.includes('connected tv') || (summary.device || '').toLowerCase().includes('ctv')
  const isPMP = briefLower.includes('pmp') || (summary.deal_type || '').toLowerCase().includes('pmp')
  const isDV360 = briefLower.includes('dv360') || (summary.integration || '').toLowerCase().includes('dv360')

  const geoContext = isBangladesh
    ? `CRITICAL: Campaign targets Bangladesh/Dhaka. ONLY suggest publishers with real Bangladesh presence:
Hoichoi, Bongo, Chorki, Toffee/BRAC TV, Channel i Digital, NTV Digital, Prothom Alo Digital, Daily Star Bangladesh.
DO NOT suggest JioCinema, Hotstar, SonyLIV, Zee5 — they have no Bangladesh operations.`
    : `Target geography: ${regions.join(', ')}`

  const deviceContext = isCTV
    ? `CTV CAMPAIGN: Only suggest OTT/streaming platforms with Smart TV apps and CTV ad inventory.`
    : ''

  const dealContext = (isPMP || isDV360)
    ? `PMP DEAL: Only suggest publishers supporting programmatic PMP deals${isDV360 ? ' and DV360 integration' : ''}.`
    : ''

  const scope = publisher_scope || 'both'
  const scopeInstruction = scope === 'india' ? 'Indian publishers only.' : scope === 'global' ? 'International publishers only.' : 'Publishers from relevant geography.'

  const prompt = `You are a programmatic media buying expert. Suggest 6 publishers for this campaign.

Campaign: ${JSON.stringify(summary)}
Brief: ${(brief || '').slice(0, 300)}

${geoContext}
${deviceContext}
${dealContext}
${scopeInstruction}

Keep ALL field values SHORT. "why" = max 12 words. "monthly_audience" = format like "5M/mo".

Return ONLY a JSON array, no markdown:
[{"name":"","site":"","category":"","region":"","language":"","monthly_audience":"","ctv_available":false,"pmp_supported":false,"contact_email":"","contact_phone":"","why":"","fit_score":85}]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
      return NextResponse.json({ error: 'Could not parse suggestions', raw_preview: raw.slice(0, 300) }, { status: 500 })
    }

    const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: (e as Error).message }, { status: 500 })
  }
}
